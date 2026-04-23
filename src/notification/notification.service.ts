import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { ExpoPushService } from './expo-push.service';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly expoPushService: ExpoPushService,
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
        roomId,
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
          ...(roomId != null && roomId !== '' ? { roomId } : {}),
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
        roomId: notification.roomId ?? undefined,
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
        case NotificationType.MESSAGE:
          this.eventEmitter.emit('message.received', ssePayload);
          break;
        default:
          break;
      }

      void this.expoPushService
        .sendForNotification({
          recipientUserId: user.id,
          title: 'afovid',
          body: notification.description.slice(0, 200),
          data: {
            notificationId: notification.id,
            postId: notification.postId ?? '',
            commentId: notification.commentId ?? '',
            roomId: notification.roomId ?? '',
            type: notification.type,
          },
        })
        .catch(() => undefined);

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

  findOneForUser(id: string, userId: string) {
    return this.prisma.notification.findFirst({
      where: { id, userId },
    });
  }

  async update(
    id: string,
    userId: string,
    updateNotificationDto: UpdateNotificationDto,
  ) {
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Notification not found');
    }
    return this.prisma.notification.update({
      where: { id },
      data: {
        ...(updateNotificationDto.read !== undefined && {
          read: updateNotificationDto.read,
        }),
      },
    });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async removeForUser(id: string, userId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Notification not found');
    }
    return this.prisma.notification.delete({
      where: { id },
    });
  }
}
