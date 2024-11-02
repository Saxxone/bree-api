import { User } from '@prisma/client';

export class CreateRoomDto {
  participants: User[];
}
