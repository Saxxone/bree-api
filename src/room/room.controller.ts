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
  findAll(
    @Request() req: any,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const s = Number.parseInt(String(skip ?? '0'), 10);
    const t = Number.parseInt(String(take ?? '50'), 10);
    return this.roomService.findAllWithParticipant(
      req.user.sub,
      Number.isFinite(s) ? Math.max(0, s) : 0,
      Number.isFinite(t) ? Math.min(Math.max(1, t), 100) : 50,
    );
  }

  @Get('/chats/:id')
  findChatsInRoom(
    @Param('id') id: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
  ) {
    const s = Number.parseInt(String(skip ?? '0'), 10);
    const t = Number.parseInt(String(take ?? '10'), 10);
    return this.roomService.findChatsInRoom(id, {
      skip: Number.isFinite(s) ? Math.max(0, s) : 0,
      take: Number.isFinite(t) ? Math.min(Math.max(1, t), 100) : 10,
      cursor: cursor?.trim() || undefined,
    });
  }

  @Post('/find-create')
  findRoomByParticipantsOrCreate(
    @Query('user1') user1Id: string,
    @Query('user2') user2Id: string,
  ) {
    return this.roomService.findRoomByParticipantsOrCreate(user1Id, user2Id);
  }

  @Patch('/update/:id')
  update(@Param('id') id: string, @Body() updateRoomDto: UpdateRoomDto) {
    return this.roomService.update(id, updateRoomDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roomService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.roomService.remove(+id);
  }
}
