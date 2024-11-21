import { Injectable } from '@nestjs/common';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationService {
  create(createNotificationDto: CreateNotificationDto) {
    return `This action adds a new notification ${createNotificationDto}`;
  }

  findAll() {
    return `This action returns all notification`;
  }

  findOne(id: string) {
    return `This action returns a #${id} notification`;
  }

  update(id: string, updateNotificationDto: UpdateNotificationDto) {
    return `This action updates a #${id} notification, ${updateNotificationDto}`;
  }

  remove(id: string) {
    return `This action removes a #${id} notification`;
  }
}
