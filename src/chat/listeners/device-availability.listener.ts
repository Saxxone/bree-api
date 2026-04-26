import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChatGateway } from '../chat.gateway';
import {
  DEVICE_KEYS_AVAILABLE_EVENT,
  type DeviceKeysAvailableEventPayload,
} from 'src/device/device.service';

@Injectable()
export class DeviceAvailabilityListener {
  private readonly logger = new Logger(DeviceAvailabilityListener.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  @OnEvent(DEVICE_KEYS_AVAILABLE_EVENT)
  async handleKeysAvailable(
    event: DeviceKeysAvailableEventPayload,
  ): Promise<void> {
    try {
      const rooms = await this.prisma.room.findMany({
        where: { participants: { some: { id: event.userId } } },
        select: { id: true },
      });
      for (const room of rooms) {
        this.chatGateway.server.to(room.id).emit('recipient-devices-available', {
          roomId: room.id,
          recipientUserId: event.userId,
          recipientDeviceId: event.deviceId,
          source: event.source,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Failed to emit recipient-devices-available for user ${event.userId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}

