import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway, ChatController } from './chat.gateway';
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
