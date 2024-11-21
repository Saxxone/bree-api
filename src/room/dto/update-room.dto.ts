import { PartialType } from '@nestjs/mapped-types';
import { CreateRoomDto } from './create-room.dto';

export class UpdateRoomDto extends PartialType(CreateRoomDto) {
  id: string;
}

export class JoinRoomDto extends PartialType(CreateRoomDto) {
  roomId: string;
  userId: string;
  publicKey: ArrayBuffer
}
