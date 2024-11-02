import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  Request,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
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

  // @SubscribeMessage('create-room')
  // create(@MessageBody() createRoomDto: CreateRoomDto) {
  //   return this.roomService.create(createRoomDto);
  // }

  // @SubscribeMessage('join-room')
  // joinRoom(@MessageBody() joinRoomDto: CreateRoomDto) {
  //   return this.roomService.create(joinRoomDto);
  // }

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

@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get('/all')
  findAll(@Request() req: any) {
    return this.roomService.findAllWithParticipant(req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roomService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRoomDto: UpdateRoomDto) {
    return this.roomService.update(+id, updateRoomDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.roomService.remove(+id);
  }
}
