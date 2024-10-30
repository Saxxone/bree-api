import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway, ChatController } from './chat.gateway';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ChatController],
  providers: [ChatGateway, ChatService, PrismaService],
})
export class ChatModule {}
