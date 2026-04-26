import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import { NotificationService } from 'src/notification/notification.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChatGateway } from '../chat.gateway';
import {
  CHAT_CREATED_EVENT,
  type ChatCreatedEventPayload,
} from '../chat.service';

@Injectable()
export class ChatCreatedListener {
  private readonly logger = new Logger(ChatCreatedListener.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * Creates a MESSAGE notification (stored + Expo push) for every recipient
   * who does NOT already have a socket joined to the room — those recipients
   * are watching the thread live so an in-app ciphertext arrival is enough.
   */
  @OnEvent(CHAT_CREATED_EVENT)
  async handleChatCreatedEvent(event: ChatCreatedEventPayload): Promise<void> {
    try {
      const sender = await this.prisma.user.findUnique({
        where: { id: event.fromUserId },
        select: { id: true, name: true, username: true, img: true },
      });
      const senderLabel =
        sender?.name?.trim() || sender?.username?.trim() || 'Someone';

      await Promise.all(
        event.toUserIds.map(async (recipientId) => {
          try {
            if (
              await this.chatGateway.isUserInRoom(event.roomId, recipientId)
            ) {
              return;
            }
            const recipient = await this.prisma.user.findUnique({
              where: { id: recipientId },
            });
            if (!recipient) return;
            await this.notificationService.create({
              type: NotificationType.MESSAGE,
              user: recipient,
              author: sender ?? undefined,
              description: `${senderLabel} sent you a message`,
              roomId: event.roomId,
            });
          } catch (err) {
            this.logger.warn(
              `Notification delivery failed for chat ${event.chat?.id} -> ${recipientId}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
        }),
      );
    } catch (err) {
      this.logger.warn(
        `Failed to dispatch MESSAGE notifications for chat ${event.chat?.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
