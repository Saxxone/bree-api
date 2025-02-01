import { Module } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, UserService],
})
export class NotificationModule {}
