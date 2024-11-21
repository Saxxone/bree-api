import { User } from '@prisma/client';

export class CreateRoomDto {
  participants: User[];
}

export class UserRoomKey {
  id: string;
  userId: string;
  roomId: string;
  encryptionKey: string;
}
