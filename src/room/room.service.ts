import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Room, User } from '@prisma/client';

@Injectable()
export class RoomService {
  constructor(private readonly prisma: PrismaService) {}

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

  update(id: number, updateRoomDto: UpdateRoomDto) {
    return `This action updates a #${id} room`;
  }

  remove(id: number) {
    return `This action removes a #${id} room`;
  }
}
