import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateChatDto } from './dto/create-chat.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Chat, Status } from '@prisma/client';
import { UserService } from 'src/user/user.service';
import { RoomService } from 'src/room/room.service';
import { UpdateChatDto } from './dto/update-chat.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly roomService: RoomService,
  ) {}

  async create(new_chat: CreateChatDto): Promise<Chat> {
    const { media, mediaType, encryptedPayload } = new_chat;
    const sender = await this.userService.findUser(new_chat.fromUserId);
    const receiver = await this.userService.findUser(new_chat.toUserId);

    if (!sender || !receiver) {
      throw new BadRequestException('Sender or receiver not found');
    }

    const senderEnc = this.normalizeEncryptedSegment(
      new_chat.senderEncryptedMessage,
      'senderEncryptedMessage',
    );
    const receiverEnc = this.normalizeEncryptedSegment(
      new_chat.receiverEncryptedMessage,
      'receiverEncryptedMessage',
    );

    const room = new_chat.roomId
      ? await this.roomService.findOne(new_chat.roomId)
      : await this.roomService.create(sender, receiver);

    if (!room?.id) {
      throw new BadRequestException('Room could not be resolved');
    }

    const created_chat = await this.prisma.chat.create({
      data: {
        ...(encryptedPayload && { encryptedPayload }),
        ...(media && { media }),
        ...(mediaType && { mediaType: [mediaType] }),
        status: Status.SENT,
        to: {
          connect: {
            id: new_chat.toUserId,
          },
        },
        from: {
          connect: {
            id: new_chat.fromUserId,
          },
        },
        room: {
          connect: {
            id: room.id,
          },
        },
        userEncryptedMessages: {
          create: [
            {
              user: { connect: { id: sender.id } },
              encryptedMessage: senderEnc,
            },
            {
              user: { connect: { id: receiver.id } },
              encryptedMessage: receiverEnc,
            },
          ],
        },
      },
      include: {
        userEncryptedMessages: true,
      },
    });

    // this.eventEmitter.emit(
    //   'chat.created',
    //   new ChatCreatedEvent({
    //     name: '',
    //     description: '',
    //     fromUserId: newChat.fromUserId,
    //   }),
    // );
    return created_chat;
  }

  /**
   * Accepts base64 string from Socket.IO JSON clients, or ArrayBuffer for legacy callers.
   */
  private normalizeEncryptedSegment(
    value: string | ArrayBuffer | undefined,
    field: string,
  ): string {
    if (value === undefined || value === null) {
      throw new BadRequestException(`Missing ${field}`);
    }
    if (typeof value === 'string') {
      return value;
    }
    return Buffer.from(value).toString('base64');
  }

  async findAll(to: 'uuid', from: 'email') {
    return await this.prisma.chat.findMany({
      where: {
        OR: [
          {
            from: { email: from },
            toUserId: to,
          },
          {
            fromUserId: to,
            to: {
              email: from,
            },
          },
        ],
      },
    });
  }

  findOne(id: number) {
    return `This action returns a #${id} chat`;
  }

  update(id: number, updateChatDto: UpdateChatDto) {
    return `This action updates a #${id} chat ${updateChatDto}`;
  }

  remove(id: number) {
    return `This action removes a #${id} chat`;
  }

  emitEvent() {
    // emit event
  }
}
