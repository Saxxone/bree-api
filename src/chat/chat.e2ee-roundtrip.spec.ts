import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChatService } from './chat.service';
import { DeviceService } from '../device/device.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { RoomService } from '../room/room.service';

/**
 * End-to-end style test that exercises the full "prekey claim → envelope
 * fanout → persist chat" path that a real client executes on every send.
 *
 * We stub Prisma with an in-memory representation that mirrors the device +
 * OTK tables. The goal is to catch regressions where claimKeys returns a set
 * of devices that ChatService then refuses to accept — a bug that wouldn't
 * show up in either unit test in isolation.
 *
 * Scenario: Alice has two devices (A1, A2), Bob has one device (B1). Alice
 * sends from A1. The expected envelope set is {A2, B1}; A1 is skipped (the
 * sender has the plaintext locally).
 */

type Device = {
  id: string;
  userId: string;
  identityKeyCurve25519: string;
  identityKeyEd25519: string;
};

type OtkRow = {
  id: string;
  deviceId: string;
  keyId: string;
  publicKey: string;
  signature: string;
  claimedAt: Date | null;
  createdAt: Date;
};

describe('Chat E2EE round-trip (claimKeys + create)', () => {
  const ALICE = 'alice-user-id';
  const BOB = 'bob-user-id';
  const A1: Device = {
    id: 'alice-device-1',
    userId: ALICE,
    identityKeyCurve25519: 'curve-a1',
    identityKeyEd25519: 'ed-a1',
  };
  const A2: Device = {
    id: 'alice-device-2',
    userId: ALICE,
    identityKeyCurve25519: 'curve-a2',
    identityKeyEd25519: 'ed-a2',
  };
  const B1: Device = {
    id: 'bob-device-1',
    userId: BOB,
    identityKeyCurve25519: 'curve-b1',
    identityKeyEd25519: 'ed-b1',
  };
  const ROOM_ID = 'room-id';

  let deviceService: DeviceService;
  let chatService: ChatService;
  const otks: Map<string, OtkRow[]> = new Map();

  beforeEach(async () => {
    otks.clear();
    otks.set(A1.id, [
      {
        id: 'otk-a1',
        deviceId: A1.id,
        keyId: 'a1-k1',
        publicKey: 'a1-pk',
        signature: 'a1-sig',
        claimedAt: null,
        createdAt: new Date(),
      },
    ]);
    otks.set(A2.id, [
      {
        id: 'otk-a2',
        deviceId: A2.id,
        keyId: 'a2-k1',
        publicKey: 'a2-pk',
        signature: 'a2-sig',
        claimedAt: null,
        createdAt: new Date(),
      },
    ]);
    otks.set(B1.id, [
      {
        id: 'otk-b1',
        deviceId: B1.id,
        keyId: 'b1-k1',
        publicKey: 'b1-pk',
        signature: 'b1-sig',
        claimedAt: null,
        createdAt: new Date(),
      },
    ]);

    const devices = [A1, A2, B1];

    const prismaStub = {
      device: {
        findMany: jest.fn(async (args: { where?: { userId?: string } }) =>
          devices.filter((d) => d.userId === args.where?.userId),
        ),
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
          devices.find((d) => d.id === where.id) ?? null,
        ),
      },
      deviceFallbackKey: { findFirst: jest.fn().mockResolvedValue(null) },
      $queryRaw: jest.fn(async (sql: { values?: unknown[] }) => {
        // Prisma.sql passes template values on the `values` array. The
        // service's claim query uses a single parameter: the target deviceId.
        const deviceId = sql?.values?.[0];
        if (typeof deviceId !== 'string') return [];
        const rows = otks.get(deviceId) ?? [];
        const row = rows.find((r) => r.claimedAt === null);
        if (!row) return [];
        row.claimedAt = new Date();
        return [
          {
            keyId: row.keyId,
            publicKey: row.publicKey,
            signature: row.signature,
          },
        ];
      }),
      room: {
        findUnique: jest.fn().mockResolvedValue({
          id: ROOM_ID,
          participants: [
            { id: ALICE, devices: [A1, A2] },
            { id: BOB, devices: [B1] },
          ],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      chat: {
        create: jest.fn().mockResolvedValue({
          id: 'chat-1',
          envelopes: [],
        }),
      },
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) =>
        cb({
          chat: {
            create: jest.fn().mockResolvedValue({
              id: 'chat-1',
              envelopes: [],
            }),
          },
          room: { update: jest.fn().mockResolvedValue({}) },
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceService,
        ChatService,
        { provide: PrismaService, useValue: prismaStub },
        { provide: UserService, useValue: {} },
        {
          provide: RoomService,
          useValue: {
            assertUserIsRoomParticipant: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    deviceService = module.get(DeviceService);
    chatService = module.get(ChatService);

    // Make sure assertDeviceOwnedByUser doesn't hit the stubbed findUnique
    // with an unsupported `select` shape. We spy and resolve directly.
    jest
      .spyOn(deviceService, 'assertDeviceOwnedByUser')
      .mockResolvedValue(undefined as unknown as never);
  });

  it('Alice@A1 sends to {self A2, peer B1} using claimed prekeys', async () => {
    // 1. Alice claims prekeys for Bob and for her other self-device.
    const bobBundles = await deviceService.claimKeys(BOB);
    const aliceBundles = await deviceService.claimKeys(ALICE);

    // Returned bundle should match each target's active devices (minus self-
    // device A1 which is filtered out by the claim consumer, not by claimKeys
    // itself — claimKeys returns all active devices; the client drops its
    // own authoring device before encrypting).
    expect(bobBundles.map((b) => b.deviceId)).toEqual([B1.id]);
    expect(aliceBundles.map((b) => b.deviceId).sort()).toEqual(
      [A1.id, A2.id].sort(),
    );

    // 2. Build the envelope fanout excluding the sender's own authoring
    //    device, exactly as the client does.
    const envelopes = [
      ...aliceBundles
        .filter((b) => b.deviceId !== A1.id)
        .map((b) => ({
          recipientUserId: ALICE,
          recipientDeviceId: b.deviceId,
          ciphertext: 'cipher-self',
          messageType: 0 as const,
        })),
      ...bobBundles.map((b) => ({
        recipientUserId: BOB,
        recipientDeviceId: b.deviceId,
        ciphertext: 'cipher-peer',
        messageType: 0 as const,
      })),
    ];
    expect(envelopes).toHaveLength(2);

    // 3. ChatService accepts the fanout and returns the persisted chat.
    const result = await chatService.create(ALICE, {
      roomId: ROOM_ID,
      senderDeviceId: A1.id,
      envelopes,
    });
    expect(result.id).toBe('chat-1');
  });

  it('ChatService rejects a message that omits the peer device envelope', async () => {
    const aliceBundles = await deviceService.claimKeys(ALICE);
    // Intentionally forget to claim Bob's bundle.
    const envelopes = aliceBundles
      .filter((b) => b.deviceId !== A1.id)
      .map((b) => ({
        recipientUserId: ALICE,
        recipientDeviceId: b.deviceId,
        ciphertext: 'cipher-self',
        messageType: 0 as const,
      }));
    await expect(
      chatService.create(ALICE, {
        roomId: ROOM_ID,
        senderDeviceId: A1.id,
        envelopes,
      }),
    ).rejects.toThrow(/Missing envelopes/);
  });
});
