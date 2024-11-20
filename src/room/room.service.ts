import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Room, User } from '@prisma/client';
import { UserService } from '../user/user.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  create(sender: User, receiver: User): Promise<Room> {
    return this.prisma.room.create({
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
    });
  }

  findAllWithParticipant(email: string) {
    return this.prisma.room.findMany({
      where: {
        participants: {
          some: {
            email,
          },
        },
      },
      include: {
        participants: true,
        chats: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  findChatsInRoom(roomId: string) {
    return this.prisma.chat.findMany({
      where: {
        roomId,
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
        participants: true,
        chats: {
          take: 1,
          orderBy: { createdAt: 'desc' },
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
        participants: {
          every: { id: { in: [user1Id, user2Id] } },
        },
      },
      include: {
        participants: true,
        chats: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (existingRoom) {
      return existingRoom;
    }

    return this.create(user1, user2);
  }

  async update(id: number, updateRoomDto: UpdateRoomDto) {
    return { id, ...updateRoomDto };
  }

  remove(id: number) {
    return `This action removes a #${id} room`;
  }
}
