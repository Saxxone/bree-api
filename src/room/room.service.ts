import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Room, RoomType, User } from '@prisma/client';
import { UserService } from '../user/user.service';

const PARTICIPANT_SELECT = {
  id: true,
  email: true,
  username: true,
  img: true,
  verified: true,
  name: true,
  devices: {
    // Include historical devices too: clients need the sender device's
    // Curve25519 identity to decrypt older envelopes even after that device
    // has later been revoked or replaced.
    select: {
      id: true,
      label: true,
      identityKeyCurve25519: true,
      identityKeyEd25519: true,
      revokedAt: true,
    },
  },
} as const;

function latestChatInclude(callerDeviceId?: string) {
  const envelopesFilter = callerDeviceId
    ? { where: { recipientDeviceId: callerDeviceId } }
    : { where: { id: '__never__' } };
  return {
    take: 1,
    orderBy: { createdAt: 'desc' as const },
    include: {
      envelopes: envelopesFilter,
      senderDevice: {
        select: { identityKeyCurve25519: true },
      },
    },
  };
}

function mapChatWithSenderIdentity<T extends { chats?: Array<any> }>(room: T): T {
  return {
    ...room,
    chats: (room.chats ?? []).map(({ senderDevice, ...chat }) => ({
      ...chat,
      senderIdentityKeyCurve25519: senderDevice?.identityKeyCurve25519,
    })),
  };
}

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  async create(sender: User, receiver: User): Promise<Room> {
    const room = await this.prisma.room.create({
      data: {
        participants: {
          connect: [
            {
              id: sender.id,
            },
            {
              id: receiver.id,
            },
          ],
        },
      },
      include: {
        participants: { select: PARTICIPANT_SELECT },
      },
    });

    return room;
  }

  async findAllWithParticipant(
    userId: string,
    skip: number = 0,
    take: number = 50,
    callerDeviceId?: string,
  ) {
    const s = Math.max(0, skip);
    const t = Math.min(Math.max(1, take), 100);
    const rooms = await this.prisma.room.findMany({
      where: {
        participants: {
          some: {
            id: userId,
          },
        },
      },
      skip: s,
      take: t,
      orderBy: { updatedAt: 'desc' },
      include: {
        participants: { select: PARTICIPANT_SELECT },
        chats: latestChatInclude(callerDeviceId),
      },
    });
    return rooms.map((room) => mapChatWithSenderIdentity(room));
  }

  /**
   * Fetch chat history for `roomId` with only the envelopes addressed to the
   * calling user's device. Clients without a registered device still get the
   * `Chat` rows for read-receipt UX but no ciphertext.
   */
  findChatsInRoom(
    roomId: string,
    callerDeviceId: string | undefined,
    opts?: { skip?: number; take?: number; cursor?: string },
  ) {
    const take = Math.min(Math.max(Number(opts?.take) || 10, 1), 100);
    const skipRaw = Math.max(Number(opts?.skip) || 0, 0);
    const raw = opts?.cursor?.trim();
    const cursor =
      raw && raw !== 'undefined' && raw !== 'null' ? raw : undefined;
    const envelopesFilter = callerDeviceId
      ? { where: { recipientDeviceId: callerDeviceId } }
      : { where: { id: '__never__' } };
    const include = {
      envelopes: envelopesFilter,
      senderDevice: {
        select: { identityKeyCurve25519: true },
      },
    } as const;
    if (cursor) {
      return this.prisma.chat
        .findMany({
        where: { roomId },
        take,
        skip: 1,
        cursor: { id: cursor },
        orderBy: { createdAt: 'desc' },
        include,
      })
        .then((rows) =>
          rows.map(({ senderDevice, ...chat }) => ({
            ...chat,
            senderIdentityKeyCurve25519:
              senderDevice.identityKeyCurve25519,
          })),
        );
    }
    return this.prisma.chat
      .findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      skip: skipRaw,
      take,
      include,
    })
      .then((rows) =>
        rows.map(({ senderDevice, ...chat }) => ({
          ...chat,
          senderIdentityKeyCurve25519: senderDevice.identityKeyCurve25519,
        })),
      );
  }

  async joinRoom(roomId: string, userId: string): Promise<boolean> {
    const user = await this.userService.findUser(userId);
    if (!user) {
      this.logger.warn(`joinRoom: user not found userId=${userId}`);
      return false;
    }
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { participants: { select: { id: true } } },
    });
    if (!room) {
      this.logger.warn(`joinRoom: room not found roomId=${roomId}`);
      return false;
    }

    const isParticipant = room.participants?.some((p) => p.id === userId);
    if (!isParticipant) {
      this.logger.warn(
        `joinRoom: reject non-participant roomId=${roomId} userId=${userId}`,
      );
      return false;
    }

    return true;
  }

  async assertUserIsRoomParticipant(
    roomId: string,
    userId: string,
  ): Promise<void> {
    const n = await this.prisma.room.count({
      where: {
        id: roomId,
        participants: { some: { id: userId } },
      },
    });
    if (n < 1) {
      throw new ForbiddenException('Not a room participant');
    }
  }

  async findOne(id: string, callerDeviceId?: string): Promise<Room | null> {
    const room = await this.prisma.room.findUnique({
      where: {
        id,
      },
      include: {
        participants: { select: PARTICIPANT_SELECT },
        chats: latestChatInclude(callerDeviceId),
      },
    });
    return room ? mapChatWithSenderIdentity(room) : null;
  }

  async findRoomByParticipantsOrCreate(
    user1Id: string,
    user2Id: string,
    callerDeviceId?: string,
  ): Promise<Room> {
    if (user1Id === user2Id) {
      throw new ForbiddenException('Cannot create a DM with yourself');
    }

    const user1 = await this.userService.findUser(user1Id);
    const user2 = await this.userService.findUser(user2Id);

    if (!user1 || !user2) {
      throw new NotFoundException('User not found');
    }

    const lookup = () =>
      this.prisma.room.findFirst({
        where: {
          roomType: RoomType.PRIVATE,
          AND: [
            { participants: { some: { id: user1Id } } },
            { participants: { some: { id: user2Id } } },
            {
              participants: {
                every: { id: { in: [user1Id, user2Id] } },
              },
            },
          ],
        },
        include: {
          participants: { select: PARTICIPANT_SELECT },
          chats: latestChatInclude(callerDeviceId),
        },
      });

    const existingRoom = await lookup();
    if (existingRoom) {
      return mapChatWithSenderIdentity(existingRoom);
    }

    try {
      return await this.create(user1, user2);
    } catch (err) {
      const raced = await lookup();
      if (raced) return mapChatWithSenderIdentity(raced);
      throw err;
    }
  }

  async update(roomId: string, updateRoomDto: UpdateRoomDto) {
    void updateRoomDto;
    return this.findOne(roomId);
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.prisma.room.delete({ where: { id } });
    return { id };
  }
}
