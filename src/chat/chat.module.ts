import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { PrismaService } from '../prisma.service';
import { RoomService } from 'src/room/room.service';
import { UserService } from 'src/user/user.service';

@Module({
  controllers: [ChatController],
  providers: [
    ChatGateway,
    ChatService,
    RoomService,
    UserService,
    PrismaService,
  ],
})
export class ChatModule {}
