import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CreateChatDto } from './dto/create-chat.dto';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: {
    namespace: 'chat',
    origin: '*',
    transports: ['websocket'],
  },
})
export class ChatGateway {
  constructor(private readonly chatService: ChatService) {}

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('send-message')
  async createChat(
    @MessageBody() chatData: CreateChatDto,
    @ConnectedSocket() client: Socket,
  ) {
    const chat = await this.chatService.create(chatData);
    if (chat) {
      this.server.to(chatData.roomId).emit('receive-message', chat);

      return chat;
    }
  }
}
