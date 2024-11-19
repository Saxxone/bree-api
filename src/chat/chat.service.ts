import { Injectable } from '@nestjs/common';
import { CreateChatDto } from './dto/create-chat.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChatCreatedEvent } from './events/chat.event';
import { PrismaService } from '../prisma.service';
import { Chat, Status } from '@prisma/client';
import { UserService } from 'src/user/user.service';
import { RoomService } from 'src/room/room.service';
import { UpdateChatDto } from './dto/update-chat.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly roomService: RoomService,
  ) {}

  async create(newChat: CreateChatDto): Promise<Chat> {
    const { text, media, mediaType } = newChat;
    const sender = await this.userService.findUser(newChat.fromUserId);
    const receiver = await this.userService.findUser(newChat.toUserId);

    const room = newChat.roomId
      ? await this.roomService.findOne(newChat.roomId)
      : await this.roomService.create(sender, receiver);

    const chat = await this.prisma.chat.create({
      data: {
        ...(text && { text }),
        ...(media && { media }),
        ...(mediaType && { mediaType: [mediaType] }),
        status: Status.SENT,
        to: {
          connect: {
            id: newChat.toUserId,
          },
        },
        from: {
          connect: {
            id: newChat.fromUserId,
          },
        },
        room: {
          connect: {
            id: room.id,
          },
        },
      },
    });

    this.eventEmitter.emit(
      'chat.created',
      new ChatCreatedEvent({
        name: newChat.text,
        description: newChat.text,
        fromUserId: newChat.fromUserId,
      }),
    );
    return chat;
  }

  async findAll(to: 'uuid', from: 'email') {
    return await this.prisma.chat.findMany({
      where: {
        OR: [
          {
            from: { email: from },
            toUserId: to,
          },
          {
            fromUserId: to,
            to: {
              email: from,
            },
          },
        ],
      },
    });
  }

  findOne(id: number) {
    return `This action returns a #${id} chat`;
  }

  update(id: number, updateChatDto: UpdateChatDto) {
    return `This action updates a #${id} chat ${updateChatDto}`;
  }

  remove(id: number) {
    return `This action removes a #${id} chat`;
  }

  emitEvent() {
    // emit event
  }
}
