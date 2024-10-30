import { Injectable } from '@nestjs/common';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChatCreatedEvent } from './events/chat.event';
import { PrismaService } from '../prisma.service';
import { Chat, Status } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
  ) {}

  async create(newChat: CreateChatDto, from: string): Promise<Chat> {
    const { text, media, mediaType } = newChat;
    console.log(from, newChat);

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
            email: from,
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


  async createRoom(){

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
    return `This action updates a #${id} chat`;
  }

  remove(id: number) {
    return `This action removes a #${id} chat`;
  }

  emitEvent() {
    // emit event
  }
}
