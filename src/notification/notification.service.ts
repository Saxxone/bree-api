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
      const {
        user,
        author,
        type,
        description,
        postId,
        commentId,
        mentionedUserId,
      } = createNotificationDto;

      const notification = await this.prisma.notification.create({
        data: {
          type,
          description,
          userId: user.id,
          ...(postId != null && postId !== '' ? { postId } : {}),
          ...(commentId != null && commentId !== '' ? { commentId } : {}),
          ...(mentionedUserId != null && mentionedUserId !== ''
            ? { mentionedUserId }
            : {}),
        },
      });

      const ssePayload = {
        id: notification.id,
        date: notification.createdAt,
        description: notification.description,
        type: notification.type,
        author,
        user,
        postId: notification.postId ?? undefined,
        commentId: notification.commentId ?? undefined,
        read: notification.read,
      };

      switch (createNotificationDto.type) {
        case NotificationType.POST_CREATED:
          this.eventEmitter.emit('post.created', ssePayload);
          break;
        case NotificationType.POST_LIKED:
          this.eventEmitter.emit('post.liked', ssePayload);
          break;
        case NotificationType.COMMENT_ADDED:
          this.eventEmitter.emit('comment.added', ssePayload);
          break;
        case NotificationType.USER_MENTIONED:
          this.eventEmitter.emit('post.created', ssePayload);
          break;
        default:
          break;
      }

      return notification;
    } catch (error) {
      console.log(error);
    }
  }

  findAll(skip: number, take: number, userId: string) {
    try {
      return this.prisma.notification.findMany({
        where: { userId },
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

  async update(id: string, updateNotificationDto: UpdateNotificationDto) {
    try {
      return await this.prisma.notification.update({
        where: { id },
        data: {
          ...(updateNotificationDto.read !== undefined && {
            read: updateNotificationDto.read,
          }),
        },
      });
    } catch (error) {
      console.log(error);
    }
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
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
