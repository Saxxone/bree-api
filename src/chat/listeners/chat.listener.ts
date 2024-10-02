import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ChatCreatedEvent } from '../events/chat.event';

@Injectable()
export class ChatCreatedListener {
  @OnEvent('chat.created')
  handleChatCreatedEvent<T>(event: ChatCreatedEvent<T>) {
    console.log(event);
  }
}