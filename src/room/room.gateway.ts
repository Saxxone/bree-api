import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { RoomService } from './room.service';
import { UpdateRoomDto } from './dto/update-room.dto';
import { ui_base_url } from 'utils';

@WebSocketGateway({
  namespace: 'room',
  cors: {
    origin: ui_base_url,
  },
})
export class RoomGateway {
  constructor(private readonly roomService: RoomService) {}

  @SubscribeMessage('findOneRoom')
  findOne(@MessageBody() id: string) {
    return this.roomService.findOne(id);
  }

  @SubscribeMessage('updateRoom')
  update(@MessageBody() updateRoomDto: UpdateRoomDto) {
    return this.roomService.update(updateRoomDto.id, updateRoomDto);
  }

  @SubscribeMessage('removeRoom')
  remove(@MessageBody() id: number) {
    return this.roomService.remove(id);
  }
}
