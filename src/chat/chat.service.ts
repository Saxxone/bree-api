import { Injectable } from '@nestjs/common';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChatCreatedEvent } from './events/chat.event';

@Injectable()
export class ChatService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  create<T>(createChatDto: CreateChatDto<T>) {
    this.eventEmitter.emit(
      'chat.created',
      new ChatCreatedEvent<T>({
        name: createChatDto.name,
        description: createChatDto.description,
        actor: createChatDto.actor,
      }),
    );

    return 'This action adds a new chat';
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
}
