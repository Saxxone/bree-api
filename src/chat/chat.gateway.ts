import { UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { FriendlyWsExceptionFilter } from '../health/ws-friendly-exception.filter';
import { socket_io_cors_origins } from '../utils';
import { Server, Socket } from 'socket.io';
import { CreateChatDto } from './dto/create-chat.dto';
import { ChatService } from './chat.service';
import { RoomService } from '../room/room.service';
import { JoinRoomDto, UpdateRoomDto } from '../room/dto/update-room.dto';

/**
 * Single Socket.IO gateway for room membership and encrypted chat messages
 * (avoids multiple default gateways competing on the same path).
 */
@WebSocketGateway({
  cors: {
    origin: socket_io_cors_origins,
    credentials: true,
  },
  transports: ['websocket'],
})
@UseFilters(FriendlyWsExceptionFilter)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: false,
  }),
)
export class ChatGateway {
  constructor(
    private readonly chatService: ChatService,
    private readonly roomService: RoomService,
  ) {}

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('find-one-room')
  findOne(@MessageBody() id: string) {
    return this.roomService.findOne(id);
  }

  @SubscribeMessage('join-room')
  async joinRoom(
    @MessageBody() roomData: JoinRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
    const status = await this.roomService.joinRoom(
      roomData.roomId,
      roomData.userId,
    );
    if (status) {
      client.join(roomData.roomId);
      this.server.to(roomData.roomId).emit('user-joined', client.id);
      return roomData;
    }
  }

  @SubscribeMessage('leave-room')
  leaveRoom(
    @MessageBody('roomId') roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    void client;
    void roomId;
  }

  @SubscribeMessage('updateRoom')
  update(@MessageBody() updateRoomDto: UpdateRoomDto) {
    return `${updateRoomDto});`;
  }

  @SubscribeMessage('removeRoom')
  remove(@MessageBody() id: number) {
    return this.roomService.remove(id);
  }

  @SubscribeMessage('send-message')
  async createChat(@MessageBody() chatData: CreateChatDto) {
    const chat = await this.chatService.create(chatData);
    const roomId = chatData.roomId ?? chat.roomId;
    if (chat && roomId) {
      this.server.to(roomId).emit('receive-message', chat);
    }
    return chat;
  }
}
