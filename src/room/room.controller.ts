import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  Query,
  Post,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { UpdateRoomDto } from './dto/update-room.dto';

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

  @Post('/find-create')
  findRoomByParticipantsOrCreate(
    @Query('user1') user1Id: string,
    @Query('user2') user2Id: string,
  ) {
    return this.roomService.findRoomByParticipantsOrCreate(user1Id, user2Id);
  }

  @Get('/chats/:id')
  findChatsInRoom(@Param('id') id: string) {
    return this.roomService.findChatsInRoom(id);
  }

  @Patch('/update/:id')
  update(@Param('id') id: string, @Body() updateRoomDto: UpdateRoomDto) {
    return this.roomService.update(id, updateRoomDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.roomService.remove(+id);
  }
}
