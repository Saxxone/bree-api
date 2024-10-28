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

  async create<T>(createChatDto: CreateChatDto<T>): Promise<Chat> {
    const chat = await this.prisma.chat.create({
      data: {
        ...createChatDto,
        status: Status.SENT,
        
      },
    });

    this.eventEmitter.emit(
      'chat.created',
      new ChatCreatedEvent<T>({
        name: createChatDto.name,
        description: createChatDto.description,
        actor: createChatDto.actor,
      }),
    );

    return chat;
  }

  findAll() {
    return `This action returns all chat`;
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

  emitEvent() {}
}
