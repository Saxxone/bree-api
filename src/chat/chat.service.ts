import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Chat, ChatEnvelope } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { RoomService } from 'src/room/room.service';
import { DeviceService } from 'src/device/device.service';
import { CreateChatDto, CreateChatEnvelopeDto } from './dto/create-chat.dto';

export const CHAT_CREATED_EVENT = 'chat.created';

export interface ChatCreatedEventPayload {
  chat: Chat;
  fromUserId: string;
  /** All recipient userIds (de-duped, excludes sender). */
  toUserIds: string[];
  roomId: string;
  envelopes: ChatEnvelope[];
}

/**
 * A Chat always fans out to ONE envelope per active device of every room
 * participant (including the sender's other devices so the sender's own
 * history syncs across devices). The sender-device's envelope is skipped —
 * it's useless to re-encrypt-to-self a message the sender already has in
 * plaintext locally.
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly roomService: RoomService,
    private readonly deviceService: DeviceService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    authedUserId: string,
    dto: CreateChatDto,
  ): Promise<Chat & { envelopes: ChatEnvelope[] }> {
    await this.roomService.assertUserIsRoomParticipant(dto.roomId, authedUserId);

    // `senderDeviceId` must belong to the authenticated user and not be revoked.
    await this.deviceService.assertDeviceOwnedByUser(
      dto.senderDeviceId,
      authedUserId,
    );

    // Load all participants + their active devices in one go so we can
    // validate the envelope fanout against the ground truth.
    const room = await this.prisma.room.findUnique({
      where: { id: dto.roomId },
      include: {
        participants: {
          select: {
            id: true,
            devices: {
              where: { revokedAt: null },
              select: { id: true, userId: true },
            },
          },
        },
      },
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    const participantIds = new Set(room.participants.map((p) => p.id));
    if (!participantIds.has(authedUserId)) {
      throw new ForbiddenException('Not a participant of this room');
    }

    this.assertFanoutMatchesRoom({
      envelopes: dto.envelopes,
      senderUserId: authedUserId,
      senderDeviceId: dto.senderDeviceId,
      participants: room.participants,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const chat = await tx.chat.create({
        data: {
          roomId: dto.roomId,
          senderUserId: authedUserId,
          senderDeviceId: dto.senderDeviceId,
          envelopes: {
            create: dto.envelopes.map((e) => ({
              recipientUserId: e.recipientUserId,
              recipientDeviceId: e.recipientDeviceId,
              ciphertext: e.ciphertext,
              messageType: e.messageType,
            })),
          },
        },
        include: { envelopes: true },
      });
      await tx.room.update({
        where: { id: dto.roomId },
        data: { updatedAt: new Date() },
      });
      return chat;
    });

    const otherUserIds = [...participantIds].filter((id) => id !== authedUserId);
    const payload: ChatCreatedEventPayload = {
      chat: created,
      fromUserId: authedUserId,
      toUserIds: otherUserIds,
      roomId: dto.roomId,
      envelopes: created.envelopes,
    };
    this.eventEmitter.emit(CHAT_CREATED_EVENT, payload);

    return created;
  }

  private assertFanoutMatchesRoom(args: {
    envelopes: CreateChatEnvelopeDto[];
    senderUserId: string;
    senderDeviceId: string;
    participants: Array<{
      id: string;
      devices: Array<{ id: string; userId: string }>;
    }>;
  }): void {
    // Build the expected {userId -> deviceId[]} set (all active devices of
    // all room participants, minus the sender's own authoring device).
    const expected = new Map<string, Set<string>>();
    for (const p of args.participants) {
      const ids = new Set<string>();
      for (const d of p.devices) {
        if (p.id === args.senderUserId && d.id === args.senderDeviceId) continue;
        ids.add(d.id);
      }
      if (ids.size > 0) expected.set(p.id, ids);
    }

    // Walk envelopes, tick off expected destinations, and reject anything
    // unexpected (wrong device, non-participant user, duplicate).
    const seen = new Set<string>();
    for (const env of args.envelopes) {
      const key = `${env.recipientUserId}:${env.recipientDeviceId}`;
      if (seen.has(key)) {
        throw new BadRequestException(
          `Duplicate envelope for device ${env.recipientDeviceId}`,
        );
      }
      seen.add(key);
      const devicesForUser = expected.get(env.recipientUserId);
      if (!devicesForUser) {
        throw new BadRequestException(
          `recipientUserId ${env.recipientUserId} is not a room participant`,
        );
      }
      if (!devicesForUser.has(env.recipientDeviceId)) {
        throw new BadRequestException(
          `recipientDeviceId ${env.recipientDeviceId} is not an active device of ${env.recipientUserId}`,
        );
      }
      devicesForUser.delete(env.recipientDeviceId);
      if (devicesForUser.size === 0) expected.delete(env.recipientUserId);
    }

    // Anything still in `expected` means the sender tried to omit a device
    // from the fanout — reject so a malicious sender cannot silently hide
    // messages from a specific peer device.
    if (expected.size > 0) {
      const missing: string[] = [];
      for (const [userId, ids] of expected.entries()) {
        for (const id of ids) missing.push(`${userId}/${id}`);
      }
      throw new BadRequestException(
        `Missing envelopes for active devices: ${missing.join(', ')}`,
      );
    }
  }

  /**
   * Mark envelopes as delivered for a given device (best-effort). Caller
   * must be the owning user of the device.
   */
  async ackEnvelopes(
    userId: string,
    deviceId: string,
    envelopeIds: string[],
  ): Promise<{ updated: number }> {
    if (envelopeIds.length === 0) return { updated: 0 };
    await this.deviceService.assertDeviceOwnedByUser(deviceId, userId);
    const res = await this.prisma.chatEnvelope.updateMany({
      where: {
        id: { in: envelopeIds },
        recipientDeviceId: deviceId,
        deliveredAt: null,
      },
      data: { deliveredAt: new Date(), read: true },
    });
    return { updated: res.count };
  }
}
