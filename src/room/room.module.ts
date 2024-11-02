import { Module } from '@nestjs/common';
import { RoomService } from './room.service';
import { RoomGateway } from './room.gateway';
import { RoomController } from './room.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [RoomController],
  providers: [RoomGateway, RoomService, PrismaService],
})
export class RoomModule {}
