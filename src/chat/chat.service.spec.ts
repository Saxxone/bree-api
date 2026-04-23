import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { RoomService } from '../room/room.service';
import { DeviceService } from '../device/device.service';

/**
 * ChatService unit tests focus on the fanout enforcement path. The goal is
 * "a sender cannot ship a message unless there's one envelope per active
 * peer device". We wire tiny Prisma/DeviceService stubs so we can drive the
 * `participants + devices` world state from the test and assert every
 * rejection branch in `assertFanoutMatchesRoom`.
 */

const SENDER_ID = 'sender-user-id';
const SENDER_DEVICE_ID = 'sender-device-id';
const ROOM_ID = 'room-id';
const PEER_USER_ID = 'peer-user-id';
const PEER_DEVICE_1 = 'peer-device-1';
const PEER_DEVICE_2 = 'peer-device-2';
const SENDER_DEVICE_2 = 'sender-device-2';

function envelope(overrides: {
  recipientUserId: string;
  recipientDeviceId: string;
}): {
  recipientUserId: string;
  recipientDeviceId: string;
  ciphertext: string;
  messageType: 0 | 1;
} {
  return {
    ciphertext: 'AAAA',
    messageType: 1,
    ...overrides,
  };
}

describe('ChatService.create fanout', () => {
  let service: ChatService;
  let prisma: {
    room: { findUnique: jest.Mock; update: jest.Mock };
    chat: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let deviceService: { assertDeviceOwnedByUser: jest.Mock };
  let roomService: { assertUserIsRoomParticipant: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      room: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      chat: { create: jest.fn() },
      $transaction: jest.fn(async (cb) =>
        cb({
          chat: {
            create: jest.fn().mockResolvedValue({
              id: 'chat-1',
              envelopes: [],
            }),
          },
          room: { update: jest.fn().mockResolvedValue({}) },
        }),
      ),
    };
    deviceService = { assertDeviceOwnedByUser: jest.fn().mockResolvedValue(true) };
    roomService = {
      assertUserIsRoomParticipant: jest.fn().mockResolvedValue(undefined),
    };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: UserService, useValue: {} },
        { provide: RoomService, useValue: roomService },
        { provide: DeviceService, useValue: deviceService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();
    service = module.get(ChatService);
  });

  function stubRoom(args: {
    participants: Array<{ id: string; deviceIds: string[] }>;
  }) {
    prisma.room.findUnique.mockResolvedValue({
      id: ROOM_ID,
      participants: args.participants.map((p) => ({
        id: p.id,
        devices: p.deviceIds.map((id) => ({ id, userId: p.id })),
      })),
    });
  }

  it('accepts a fanout covering every non-sender active device', async () => {
    stubRoom({
      participants: [
        { id: SENDER_ID, deviceIds: [SENDER_DEVICE_ID, SENDER_DEVICE_2] },
        { id: PEER_USER_ID, deviceIds: [PEER_DEVICE_1, PEER_DEVICE_2] },
      ],
    });

    await expect(
      service.create(SENDER_ID, {
        roomId: ROOM_ID,
        senderDeviceId: SENDER_DEVICE_ID,
        envelopes: [
          // Sender's other device (self-sync).
          envelope({
            recipientUserId: SENDER_ID,
            recipientDeviceId: SENDER_DEVICE_2,
          }),
          envelope({
            recipientUserId: PEER_USER_ID,
            recipientDeviceId: PEER_DEVICE_1,
          }),
          envelope({
            recipientUserId: PEER_USER_ID,
            recipientDeviceId: PEER_DEVICE_2,
          }),
        ],
      }),
    ).resolves.toBeDefined();
    expect(eventEmitter.emit).toHaveBeenCalled();
  });

  it('rejects when a peer device envelope is missing', async () => {
    stubRoom({
      participants: [
        { id: SENDER_ID, deviceIds: [SENDER_DEVICE_ID] },
        { id: PEER_USER_ID, deviceIds: [PEER_DEVICE_1, PEER_DEVICE_2] },
      ],
    });

    await expect(
      service.create(SENDER_ID, {
        roomId: ROOM_ID,
        senderDeviceId: SENDER_DEVICE_ID,
        envelopes: [
          envelope({
            recipientUserId: PEER_USER_ID,
            recipientDeviceId: PEER_DEVICE_1,
          }),
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an envelope targeting a non-participant user', async () => {
    stubRoom({
      participants: [
        { id: SENDER_ID, deviceIds: [SENDER_DEVICE_ID] },
        { id: PEER_USER_ID, deviceIds: [PEER_DEVICE_1] },
      ],
    });

    await expect(
      service.create(SENDER_ID, {
        roomId: ROOM_ID,
        senderDeviceId: SENDER_DEVICE_ID,
        envelopes: [
          envelope({
            recipientUserId: PEER_USER_ID,
            recipientDeviceId: PEER_DEVICE_1,
          }),
          envelope({
            recipientUserId: 'stranger-user-id',
            recipientDeviceId: 'stranger-device-id',
          }),
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate envelopes for the same device', async () => {
    stubRoom({
      participants: [
        { id: SENDER_ID, deviceIds: [SENDER_DEVICE_ID] },
        { id: PEER_USER_ID, deviceIds: [PEER_DEVICE_1] },
      ],
    });

    await expect(
      service.create(SENDER_ID, {
        roomId: ROOM_ID,
        senderDeviceId: SENDER_DEVICE_ID,
        envelopes: [
          envelope({
            recipientUserId: PEER_USER_ID,
            recipientDeviceId: PEER_DEVICE_1,
          }),
          envelope({
            recipientUserId: PEER_USER_ID,
            recipientDeviceId: PEER_DEVICE_1,
          }),
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when sender is not a room participant', async () => {
    stubRoom({
      participants: [
        { id: 'other-user', deviceIds: ['other-device'] },
        { id: PEER_USER_ID, deviceIds: [PEER_DEVICE_1] },
      ],
    });

    await expect(
      service.create(SENDER_ID, {
        roomId: ROOM_ID,
        senderDeviceId: SENDER_DEVICE_ID,
        envelopes: [
          envelope({
            recipientUserId: PEER_USER_ID,
            recipientDeviceId: PEER_DEVICE_1,
          }),
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
