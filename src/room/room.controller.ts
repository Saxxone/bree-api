import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
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
      req.user.userId,
      Number.isFinite(s) ? Math.max(0, s) : 0,
      Number.isFinite(t) ? Math.min(Math.max(1, t), 100) : 50,
    );
  }

  @Get('/chats/:id')
  async findChatsInRoom(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
    @Query('deviceId') deviceId?: string,
  ) {
    await this.roomService.assertUserIsRoomParticipant(id, req.user.userId);
    const s = Number.parseInt(String(skip ?? '0'), 10);
    const t = Number.parseInt(String(take ?? '10'), 10);
    const rawDevice = deviceId?.trim();
    return this.roomService.findChatsInRoom(
      id,
      rawDevice && rawDevice !== 'undefined' && rawDevice !== 'null'
        ? rawDevice
        : undefined,
      {
        skip: Number.isFinite(s) ? Math.max(0, s) : 0,
        take: Number.isFinite(t) ? Math.min(Math.max(1, t), 100) : 10,
        cursor: cursor?.trim() || undefined,
      },
    );
  }

  @Post('/find-create')
  findRoomByParticipantsOrCreate(
    @Request() req: { user: { userId: string } },
    @Query('user1') user1Id: string,
    @Query('user2') user2Id: string,
  ) {
    if (user1Id !== req.user.userId && user2Id !== req.user.userId) {
      throw new ForbiddenException('Must be one of the participants');
    }
    return this.roomService.findRoomByParticipantsOrCreate(user1Id, user2Id);
  }

  @Patch('/update/:id')
  async update(
    @Param('id') id: string,
    @Body() updateRoomDto: UpdateRoomDto,
    @Request() req: { user: { userId: string } },
  ) {
    await this.roomService.assertUserIsRoomParticipant(id, req.user.userId);
    return this.roomService.update(id, updateRoomDto);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    await this.roomService.assertUserIsRoomParticipant(id, req.user.userId);
    return this.roomService.findOne(id);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    await this.roomService.assertUserIsRoomParticipant(id, req.user.userId);
    return this.roomService.remove(id);
  }
}
