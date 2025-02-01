import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(createNotificationDto: CreateNotificationDto) {
    try {
      console.log(createNotificationDto);
      const notification = await this.prisma.notification.create({
        data: {
          ...createNotificationDto,
          user: {
            connect: { id: createNotificationDto.user.id },
          },
        },
      });

      console.log(notification);

      switch (createNotificationDto.type) {
        case NotificationType.POST_CREATED:
          this.eventEmitter.emit('post.created', createNotificationDto);
          break;
        case NotificationType.COMMENT_ADDED:
          this.eventEmitter.emit('post.created', createNotificationDto);
          break;
        case NotificationType.USER_MENTIONED:
          this.eventEmitter.emit('post.created', createNotificationDto);
          break;
        default:
          break;
      }

      return notification;
    } catch (error) {
      console.log(error);
    }
  }

  findAll(skip: number, take: number) {
    try {
      return this.prisma.notification.findMany({
        skip,
        take,
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      console.log(error);
    }
  }

  findOne(id: string) {
    try {
      return this.prisma.notification.findUnique({
        where: {
          id,
        },
      });
    } catch (error) {
      console.log(error);
    }
  }

  update(id: string, updateNotificationDto: UpdateNotificationDto) {
    return `This action updates a #${id} notification, ${updateNotificationDto}`;
  }

  remove(id: string) {
    try {
      return this.prisma.notification.delete({
        where: {
          id,
        },
      });
    } catch (error) {
      console.log(error);
    }
  }
}
