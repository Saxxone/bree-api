import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { RoomService } from './room.service';
import { UpdateRoomDto } from './dto/update-room.dto';
import { ui_base_url } from 'utils';
import { JoinRoomDto } from '../room/dto/update-room.dto';
import { Socket, Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    namespace: 'room',
    origin: ui_base_url,
    transports: ['websocket'],
  },
})
export class RoomGateway {
  constructor(private readonly roomService: RoomService) {}

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('findOneRoom')
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
      console.log(`User ${client.id} joined room ${roomData.roomId}`);
      return roomData;
    }
  }

  @SubscribeMessage('leave-room')
  leaveRoom(
    @MessageBody('roomId') roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    // client.leave(roomId);
    console.log(`User ${client.id} left room ${roomId}`);
  }

  @SubscribeMessage('updateRoom')
  update(@MessageBody() updateRoomDto: UpdateRoomDto) {
    // return this.roomService.update(updateRoomDto.id, updateRoomDto);
  }

  @SubscribeMessage('removeRoom')
  remove(@MessageBody() id: number) {
    return this.roomService.remove(id);
  }
}
