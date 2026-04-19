import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { CreateRoomDto } from './create-room.dto';

export class UpdateRoomDto extends PartialType(CreateRoomDto) {}

export class JoinRoomDto {
  @IsUUID()
  roomId: string;

  @IsUUID()
  userId: string;

  /** Optional; reserved for future key exchange. */
  @IsOptional()
  @IsString()
  publicKey?: string;
}
