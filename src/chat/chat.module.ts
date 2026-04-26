import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { RoomService } from 'src/room/room.service';
import { UserService } from 'src/user/user.service';
import { AuthModule } from 'src/auth/auth.module';
import { NotificationModule } from 'src/notification/notification.module';
import { DeviceModule } from 'src/device/device.module';
import { ChatCreatedListener } from './listeners/chat.listener';
import { DeviceAvailabilityListener } from './listeners/device-availability.listener';

@Module({
  imports: [AuthModule, NotificationModule, DeviceModule],
  providers: [
    ChatGateway,
    ChatService,
    RoomService,
    UserService,
    PrismaService,
    ChatCreatedListener,
    DeviceAvailabilityListener,
  ],
})
export class ChatModule {}
