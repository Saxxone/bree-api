import { Module } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { ExpoPushService } from './expo-push.service';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, UserService, ExpoPushService],
  exports: [NotificationService],
})
export class NotificationModule {}
