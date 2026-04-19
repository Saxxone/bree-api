import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RoomService } from './room.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';

/**
 * Manual two-client check (after `npm run start:dev` + migrate):
 * 1. Open bree-web messages in two browsers as two different users with public keys set.
 * 2. Open the same DM room; confirm both receive `receive-message` after send.
 * 3. Send a message >500 chars; both should decrypt (hybrid AES-GCM + RSA).
 */

describe('RoomService', () => {
  let service: RoomService;
  const prisma = {
    room: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
  const userService = {
    findUser: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomService,
        { provide: PrismaService, useValue: prisma },
        { provide: UserService, useValue: userService },
      ],
    }).compile();
    service = module.get(RoomService);
  });

  it('findRoomByParticipantsOrCreate queries PRIVATE room with both participants', async () => {
    userService.findUser.mockImplementation((id: string) =>
      Promise.resolve({ id, email: `${id}@example.com` } as any),
    );
    prisma.room.findFirst.mockResolvedValue({
      id: 'room-1',
      participants: [],
      chats: [],
    });

    const room = await service.findRoomByParticipantsOrCreate('u1', 'u2');

    expect(room.id).toBe('room-1');
    expect(prisma.room.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          roomType: 'PRIVATE',
          AND: expect.arrayContaining([
            { participants: { some: { id: 'u1' } } } as any,
            { participants: { some: { id: 'u2' } } } as any,
            {
              participants: {
                every: { id: { in: ['u1', 'u2'] } } },
            } as any,
          ]),
        }),
      }),
    );
    expect(prisma.room.create).not.toHaveBeenCalled();
  });

  it('findRoomByParticipantsOrCreate creates a room when none exists', async () => {
    userService.findUser.mockImplementation((id: string) =>
      Promise.resolve({ id, email: `${id}@example.com` } as any),
    );
    prisma.room.findFirst.mockResolvedValue(null);
    prisma.room.create.mockResolvedValue({
      id: 'new-room',
      participants: [],
      chats: [],
    });

    const room = await service.findRoomByParticipantsOrCreate('u1', 'u2');

    expect(room.id).toBe('new-room');
    expect(prisma.room.create).toHaveBeenCalled();
  });

  it('findRoomByParticipantsOrCreate throws when a user is missing', async () => {
    userService.findUser.mockResolvedValue(null);

    await expect(
      service.findRoomByParticipantsOrCreate('u1', 'u2'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
