import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Room, RoomType, User } from '@prisma/client';
import { UserService } from '../user/user.service';

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  async create(sender: User, receiver: User): Promise<Room> {
    const room = await this.prisma.room.create({
      data: {
        participants: {
          connect: [
            {
              id: sender.id,
            },
            {
              id: receiver.id,
            },
          ],
        },
      },
      include: {
        participants: {
          select: {
            id: true,
            email: true,
            username: true,
            img: true,
            verified: true,
            publicKey: true,
            name: true,
          },
        },
        chats: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            userEncryptedMessages: true,
          },
        },
      },
    });

    return room;
  }

  findAllWithParticipant(email: string, skip: number = 0, take: number = 50) {
    const s = Math.max(0, skip);
    const t = Math.min(Math.max(1, take), 100);
    return this.prisma.room.findMany({
      where: {
        participants: {
          some: {
            email,
          },
        },
      },
      skip: s,
      take: t,
      orderBy: { updatedAt: 'desc' },
      include: {
        participants: {
          select: {
            id: true,
            email: true,
            username: true,
            img: true,
            verified: true,
            publicKey: true,
            name: true,
          },
        },
        chats: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            userEncryptedMessages: true,
          },
        },
      },
    });
  }

  findChatsInRoom(
    roomId: string,
    opts?: { skip?: number; take?: number; cursor?: string },
  ) {
    const take = Math.min(Math.max(Number(opts?.take) || 10, 1), 100);
    const skipRaw = Math.max(Number(opts?.skip) || 0, 0);
    const cursor = opts?.cursor?.trim();
    if (cursor) {
      return this.prisma.chat.findMany({
        where: { roomId },
        take,
        skip: 1,
        cursor: { id: cursor },
        orderBy: { createdAt: 'desc' },
        include: {
          userEncryptedMessages: true,
        },
      });
    }
    return this.prisma.chat.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      skip: skipRaw,
      take,
      include: {
        userEncryptedMessages: true,
      },
    });
  }

  async joinRoom(roomId: string, userId: string): Promise<boolean> {
    try {
      const user = await this.userService.findUser(userId);
      const room = await this.findOne(roomId);

      if (!user || !room) {
        throw new NotFoundException('User or room not found');
      }

      await this.prisma.room.update({
        where: { id: roomId },
        data: {
          participants: {
            connect: { id: userId },
          },
        },
      });

      return true;
    } catch (error: Error | any) {
      this.logger.error(
        `Error joining room roomId: ${roomId} userId: ${userId}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  async findOne(id: string): Promise<Room> {
    const room = await (this.prisma.room.findUnique({
      where: {
        id,
      },
      include: {
        participants: {
          select: {
            id: true,
            email: true,
            username: true,
            img: true,
            verified: true,
            publicKey: true,
            name: true,
          },
        },
        chats: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            userEncryptedMessages: true,
          },
        },
      },
    }) ?? null);
    return room;
  }

  async findRoomByParticipantsOrCreate(
    user1Id: string,
    user2Id: string,
  ): Promise<Room> {
    const user1 = await this.userService.findUser(user1Id);

    const user2 = await this.userService.findUser(user2Id);

    if (!user1 || !user2) {
      throw new NotFoundException('User not found');
    }

    const existingRoom = await this.prisma.room.findFirst({
      where: {
        roomType: RoomType.PRIVATE,
        AND: [
          { participants: { some: { id: user1Id } } },
          { participants: { some: { id: user2Id } } },
          {
            participants: {
              every: { id: { in: [user1Id, user2Id] } },
            },
          },
        ],
      },
      include: {
        participants: {
          select: {
            id: true,
            email: true,
            username: true,
            img: true,
            verified: true,
            publicKey: true,
            name: true,
          },
        },
        chats: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            userEncryptedMessages: true,
          },
        },
      },
    });

    if (existingRoom) {
      return existingRoom;
    }

    return this.create(user1, user2);
  }

  async update(roomId: string, updateRoomDto: UpdateRoomDto) {
    return updateRoomDto;
  }

  remove(id: number) {
    return `This action removes a #${id} room`;
  }
}
