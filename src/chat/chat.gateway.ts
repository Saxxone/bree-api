import { UseFilters } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { FriendlyWsExceptionFilter } from '../health/ws-friendly-exception.filter';
import { socket_io_cors_origins } from '../utils';
import { Server } from 'socket.io';
import { CreateChatDto } from './dto/create-chat.dto';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: {
    origin: socket_io_cors_origins,
    credentials: true,
  },
  transports: ['websocket'],
})
@UseFilters(FriendlyWsExceptionFilter)
export class ChatGateway {
  constructor(private readonly chatService: ChatService) {}

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('send-message')
  async createChat(
    @MessageBody() chatData: CreateChatDto,
    // @ConnectedSocket() client: Socket,
  ) {
    const chat = await this.chatService.create(chatData);
    if (chat) {
      this.server.to(chatData.roomId).emit('receive-message', chat);

      return chat;
    }
  }
}
