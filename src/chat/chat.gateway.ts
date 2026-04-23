import { UseFilters, UsePipes, ValidationPipe, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { FriendlyWsExceptionFilter } from '../health/ws-friendly-exception.filter';
import { socket_io_cors_origins } from '../utils';
import { Server, Socket } from 'socket.io';
import { CreateChatDto } from './dto/create-chat.dto';
import { ChatService } from './chat.service';
import { DeviceService } from '../device/device.service';
import { RoomService } from '../room/room.service';
import { JoinRoomDto, UpdateRoomDto } from '../room/dto/update-room.dto';
import { AuthService } from 'src/auth/auth.service';

/**
 * Per-user token-bucket style counters for expensive socket handlers.
 * `@nestjs/throttler`'s default guard only wires into the HTTP context, so
 * WebSockets need a lightweight in-process limiter to keep a single user from
 * flooding `send-message` or `join-room`.
 */
interface RateBucket {
  count: number;
  resetAt: number;
}

const sendMessageBuckets = new Map<string, RateBucket>();
const joinRoomBuckets = new Map<string, RateBucket>();

function consumeRateLimit(
  store: Map<string, RateBucket>,
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count += 1;
  return true;
}

interface SocketData {
  userId?: string;
  deviceId?: string;
}

/**
 * Single Socket.IO gateway for room membership and encrypted chat messages
 * (avoids multiple default gateways competing on the same path).
 */
@WebSocketGateway({
  cors: {
    origin: socket_io_cors_origins,
    credentials: true,
  },
  transports: ['websocket'],
})
@UseFilters(FriendlyWsExceptionFilter)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: false,
  }),
)
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly roomService: RoomService,
    private readonly deviceService: DeviceService,
    private readonly authService: AuthService,
  ) {}

  @WebSocketServer()
  server: Server;

  async handleConnection(client: Socket) {
    const token = this.extractSocketToken(client);
    if (!token) {
      this.logger.debug('WebSocket: no token, disconnecting');
      client.disconnect(true);
      return;
    }
    const payload = await this.authService.validateAccessTokenString(token);
    if (!payload) {
      this.logger.debug('WebSocket: invalid access token, disconnecting');
      client.disconnect(true);
      return;
    }

    // `deviceId` is required on the new protocol so we can route envelopes
    // directly to the socket belonging to a specific device and nothing else.
    const auth = client.handshake.auth as
      | { token?: string; deviceId?: string }
      | undefined;
    const deviceId = auth?.deviceId;
    if (!deviceId || typeof deviceId !== 'string') {
      this.logger.debug(
        'WebSocket: missing handshake.auth.deviceId, disconnecting',
      );
      client.disconnect(true);
      return;
    }
    try {
      await this.deviceService.assertDeviceOwnedByUser(deviceId, payload.userId);
    } catch {
      this.logger.debug(
        `WebSocket: device ${deviceId} not owned by user ${payload.userId}, disconnecting`,
      );
      client.disconnect(true);
      return;
    }
    (client.data as SocketData).userId = payload.userId;
    (client.data as SocketData).deviceId = deviceId;
    // Per-device room: envelopes fan out to a room named after the target
    // deviceId so only that device's sockets receive the ciphertext.
    void client.join(`device:${deviceId}`);
    void this.deviceService.touchLastSeen(deviceId);
  }

  async isUserInRoom(roomId: string, userId: string): Promise<boolean> {
    try {
      const sockets = await this.server.in(roomId).fetchSockets();
      return sockets.some((s) => {
        const uid = (s.data as SocketData | undefined)?.userId;
        return uid === userId;
      });
    } catch {
      return false;
    }
  }

  private extractSocketToken(client: Socket): string | undefined {
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token && typeof auth.token === 'string' && auth.token.length > 0) {
      return auth.token;
    }
    const h = client.handshake.headers.authorization;
    if (h && typeof h === 'string' && h.startsWith('Bearer ')) {
      return h.split(' ')[1];
    }
    return undefined;
  }

  @SubscribeMessage('find-one-room')
  async findOne(
    @MessageBody() id: string,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = (client.data as SocketData).userId;
    if (!userId) {
      throw new WsException('Unauthorized');
    }
    try {
      await this.roomService.assertUserIsRoomParticipant(id, userId);
    } catch {
      throw new WsException('Forbidden');
    }
    const room = await this.roomService.findOne(id);
    if (!room) {
      throw new WsException('Not found');
    }
    return room;
  }

  @SubscribeMessage('join-room')
  async joinRoom(
    @MessageBody() roomData: JoinRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = (client.data as SocketData).userId;
    if (!userId) {
      throw new WsException('Unauthorized');
    }
    if (roomData.userId && roomData.userId !== userId) {
      throw new WsException('userId does not match session');
    }
    if (!consumeRateLimit(joinRoomBuckets, userId, 120, 10_000)) {
      throw new WsException('Too many join-room requests');
    }
    const status = await this.roomService.joinRoom(roomData.roomId, userId);
    if (status) {
      void client.join(roomData.roomId);
      this.server.to(roomData.roomId).emit('user-joined', client.id);
      return { roomId: roomData.roomId, userId };
    }
  }

  @SubscribeMessage('leave-room')
  leaveRoom(
    @MessageBody('roomId') roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (roomId) {
      void client.leave(roomId);
    }
  }

  @SubscribeMessage('updateRoom')
  update(
    @MessageBody() _updateRoomDto: UpdateRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
    void _updateRoomDto;
    void client;
    return { ok: false, message: 'not implemented' };
  }

  @SubscribeMessage('send-message')
  async createChat(
    @MessageBody() chatData: CreateChatDto,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = (client.data as SocketData).userId;
    const socketDeviceId = (client.data as SocketData).deviceId;
    if (!userId || !socketDeviceId) {
      throw new WsException('Unauthorized');
    }
    if (chatData.senderDeviceId !== socketDeviceId) {
      throw new WsException('senderDeviceId does not match socket device');
    }
    // Roughly ~1 message / second sustained with 30-message bursts. Matches
    // what a normal chat composer produces and blocks socket-level spam.
    if (!consumeRateLimit(sendMessageBuckets, userId, 30, 30_000)) {
      throw new WsException('Too many messages, slow down');
    }
    try {
      await this.roomService.assertUserIsRoomParticipant(
        chatData.roomId,
        userId,
      );
    } catch {
      throw new WsException('Not a participant of this room');
    }

    const chat = await this.chatService.create(userId, chatData);

    // Broadcast one targeted `receive-message` per envelope. Each envelope is
    // scoped to `device:<recipientDeviceId>` which only the sockets of that
    // device have joined, so a user can never see ciphertext addressed to a
    // sibling device.
    for (const envelope of chat.envelopes) {
      this.server.to(`device:${envelope.recipientDeviceId}`).emit(
        'receive-message',
        {
          chatId: chat.id,
          senderUserId: chat.senderUserId,
          senderDeviceId: chat.senderDeviceId,
          roomId: chat.roomId,
          createdAt: chat.createdAt,
          envelope: {
            id: envelope.id,
            recipientUserId: envelope.recipientUserId,
            recipientDeviceId: envelope.recipientDeviceId,
            ciphertext: envelope.ciphertext,
            messageType: envelope.messageType,
          },
        },
      );
    }

    return {
      id: chat.id,
      roomId: chat.roomId,
      senderUserId: chat.senderUserId,
      senderDeviceId: chat.senderDeviceId,
      createdAt: chat.createdAt,
    };
  }

  @SubscribeMessage('ack-envelopes')
  async ackEnvelopes(
    @MessageBody() body: { envelopeIds: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = (client.data as SocketData).userId;
    const deviceId = (client.data as SocketData).deviceId;
    if (!userId || !deviceId) {
      throw new WsException('Unauthorized');
    }
    const ids = Array.isArray(body?.envelopeIds) ? body.envelopeIds : [];
    return this.chatService.ackEnvelopes(userId, deviceId, ids.slice(0, 256));
  }
}
