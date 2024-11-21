import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ChatCreatedEvent } from '../events/chat.event';

@Injectable()
export class ChatCreatedListener {
  @OnEvent('chat.created')
  handleChatCreatedEvent(event: ChatCreatedEvent) {
    console.log(event);
  }
}
