import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  OlmSignedKeyDto,
  RegisterDeviceDto,
  UploadOneTimeKeysDto,
} from './dto/device.dto';
import { verifySignedPublicKey } from './olm-signature';

/**
 * Below this available-OTK count, clients should top up the server pool.
 * Exposed via `GET /device/keys/otk-count` and enforced on the client.
 */
export const OTK_LOW_WATER_MARK = 20;
export const OTK_TARGET = 100;
export const DEVICE_KEYS_AVAILABLE_EVENT = 'device.keys.available';

export interface DeviceKeysAvailableEventPayload {
  userId: string;
  deviceId: string;
  source: 'register' | 'upload-otk';
}

/** Max unclaimed OTKs a device may hold to prevent unbounded storage. */
export const OTK_POOL_MAX = 200;

export interface PublicDeviceSummary {
  id: string;
  userId: string;
  label: string;
  identityKeyCurve25519: string;
  identityKeyEd25519: string;
  createdAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
}

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Validate that each signed key is signed by the supplied identity key.
   * Throws `BadRequestException` on the first invalid signature so clients
   * get deterministic error messages rather than silent drops.
   */
  private assertSignedKeys(
    identityKeyEd25519: string,
    keys: OlmSignedKeyDto[],
    what: string,
  ): void {
    for (const key of keys) {
      const ok = verifySignedPublicKey({
        identityKeyEd25519,
        publicKey: key.publicKey,
        signature: key.signature,
      });
      if (!ok) {
        throw new BadRequestException(
          `Invalid Ed25519 signature on ${what} keyId=${key.keyId}`,
        );
      }
    }
  }

  async register(
    userId: string,
    dto: RegisterDeviceDto,
  ): Promise<PublicDeviceSummary> {
    this.assertSignedKeys(
      dto.identityKeyEd25519,
      dto.oneTimeKeys,
      'one-time key',
    );
    this.assertSignedKeys(
      dto.identityKeyEd25519,
      [dto.fallbackKey],
      'fallback key',
    );

    // A malicious client could register an Ed25519 key that already exists
    // for another user. The DB unique index is the final guard, but surface a
    // clean 400 instead of a 500.
    const existing = await this.prisma.device.findUnique({
      where: { identityKeyEd25519: dto.identityKeyEd25519 },
      select: { id: true, userId: true, revokedAt: true },
    });
    if (existing && existing.userId !== userId) {
      throw new BadRequestException('identityKey already registered');
    }

    const device = await this.prisma.$transaction(async (tx) => {
      // Re-registering an existing identity key for the same user just
      // refreshes the label + prekeys rather than creating a duplicate device.
      const reused =
        existing && existing.userId === userId
          ? await tx.device.update({
              where: { id: existing.id },
              data: {
                label: dto.label,
                identityKeyCurve25519: dto.identityKeyCurve25519,
                revokedAt: null,
                lastSeenAt: new Date(),
              },
            })
          : await tx.device.create({
              data: {
                userId,
                label: dto.label,
                identityKeyCurve25519: dto.identityKeyCurve25519,
                identityKeyEd25519: dto.identityKeyEd25519,
              },
            });

      if (reused && existing) {
        // Clear old key material so we don't leak reservations from a prior
        // install.
        await tx.deviceOneTimeKey.deleteMany({
          where: { deviceId: reused.id },
        });
        await tx.deviceFallbackKey.deleteMany({
          where: { deviceId: reused.id },
        });
      }

      await tx.deviceOneTimeKey.createMany({
        data: dto.oneTimeKeys.map((k) => ({
          deviceId: reused.id,
          keyId: k.keyId,
          publicKey: k.publicKey,
          signature: k.signature,
        })),
      });
      await tx.deviceFallbackKey.create({
        data: {
          deviceId: reused.id,
          keyId: dto.fallbackKey.keyId,
          publicKey: dto.fallbackKey.publicKey,
          signature: dto.fallbackKey.signature,
        },
      });
      return reused;
    });

    this.eventEmitter.emit(DEVICE_KEYS_AVAILABLE_EVENT, {
      userId,
      deviceId: device.id,
      source: 'register',
    } satisfies DeviceKeysAvailableEventPayload);

    return this.toPublic(device);
  }

  async listForUser(userId: string): Promise<PublicDeviceSummary[]> {
    const rows = await this.prisma.device.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toPublic(r));
  }

  async revoke(userId: string, deviceId: string): Promise<{ id: string }> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });
    if (!device || device.userId !== userId) {
      throw new NotFoundException('Device not found');
    }
    if (device.revokedAt) {
      return { id: device.id };
    }
    await this.prisma.$transaction([
      this.prisma.device.update({
        where: { id: deviceId },
        data: { revokedAt: new Date() },
      }),
      this.prisma.deviceOneTimeKey.deleteMany({ where: { deviceId } }),
      this.prisma.deviceFallbackKey.deleteMany({ where: { deviceId } }),
    ]);
    return { id: deviceId };
  }

  async touchLastSeen(deviceId: string): Promise<void> {
    try {
      await this.prisma.device.update({
        where: { id: deviceId },
        data: { lastSeenAt: new Date() },
      });
    } catch {
      // lastSeen is best-effort telemetry — never break the caller.
    }
  }

  async uploadOneTimeKeys(
    userId: string,
    deviceId: string,
    dto: UploadOneTimeKeysDto,
  ): Promise<{ accepted: number; unclaimed: number }> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });
    if (!device || device.userId !== userId) {
      throw new NotFoundException('Device not found');
    }
    if (device.revokedAt) {
      throw new ForbiddenException('Device is revoked');
    }

    const requestedOtks = Array.isArray(dto.oneTimeKeys) ? dto.oneTimeKeys : [];
    if (requestedOtks.length === 0 && !dto.fallbackKey) {
      throw new BadRequestException(
        'Provide at least one oneTimeKey or a fallbackKey',
      );
    }
    if (requestedOtks.length > 0) {
      this.assertSignedKeys(
        device.identityKeyEd25519,
        requestedOtks,
        'one-time key',
      );
    }
    if (dto.fallbackKey) {
      this.assertSignedKeys(
        device.identityKeyEd25519,
        [dto.fallbackKey],
        'fallback key',
      );
    }

    const unclaimedBefore = await this.prisma.deviceOneTimeKey.count({
      where: { deviceId, claimedAt: null },
    });
    if (unclaimedBefore + requestedOtks.length > OTK_POOL_MAX) {
      throw new BadRequestException('One-time key pool is full');
    }

    // Skip duplicate keyIds (idempotent replenish) rather than 500ing on the
    // unique index.
    const existingIds = new Set(
      (
        await this.prisma.deviceOneTimeKey.findMany({
          where: {
            deviceId,
            keyId: { in: requestedOtks.map((k) => k.keyId) },
          },
          select: { keyId: true },
        })
      ).map((r) => r.keyId),
    );
    const toInsert = requestedOtks.filter((k) => !existingIds.has(k.keyId));

    await this.prisma.$transaction(async (tx) => {
      if (toInsert.length > 0) {
        await tx.deviceOneTimeKey.createMany({
          data: toInsert.map((k) => ({
            deviceId,
            keyId: k.keyId,
            publicKey: k.publicKey,
            signature: k.signature,
          })),
        });
      }
      if (dto.fallbackKey) {
        // Retire all currently-active fallback keys for this device, then
        // insert the new one as active.
        await tx.deviceFallbackKey.updateMany({
          where: { deviceId, retiredAt: null },
          data: { retiredAt: new Date() },
        });
        await tx.deviceFallbackKey.create({
          data: {
            deviceId,
            keyId: dto.fallbackKey.keyId,
            publicKey: dto.fallbackKey.publicKey,
            signature: dto.fallbackKey.signature,
          },
        });
      }
    });

    await this.touchLastSeen(deviceId);

    if (toInsert.length > 0) {
      this.eventEmitter.emit(DEVICE_KEYS_AVAILABLE_EVENT, {
        userId,
        deviceId,
        source: 'upload-otk',
      } satisfies DeviceKeysAvailableEventPayload);
    }

    return {
      accepted: toInsert.length,
      unclaimed: unclaimedBefore + toInsert.length,
    };
  }

  async unclaimedOtkCount(
    userId: string,
    deviceId: string,
  ): Promise<{ count: number; lowWaterMark: number; target: number }> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true, userId: true, revokedAt: true },
    });
    if (!device || device.userId !== userId) {
      throw new NotFoundException('Device not found');
    }
    if (device.revokedAt) {
      return { count: 0, lowWaterMark: OTK_LOW_WATER_MARK, target: OTK_TARGET };
    }
    const count = await this.prisma.deviceOneTimeKey.count({
      where: { deviceId, claimedAt: null },
    });
    return { count, lowWaterMark: OTK_LOW_WATER_MARK, target: OTK_TARGET };
  }

  /**
   * Return one prekey bundle (identity + OTK if available else fallback) for
   * every active device of `targetUserId`, atomically reserving the OTK so it
   * cannot be claimed by another caller.
   *
   * The OTK claim uses `UPDATE ... WHERE claimedAt IS NULL` so two concurrent
   * claims cannot both receive the same row (Postgres `UPDATE` holds a row
   * lock and re-evaluates the predicate).
   */
  async claimKeys(targetUserId: string): Promise<
    Array<{
      deviceId: string;
      identityKeyCurve25519: string;
      identityKeyEd25519: string;
      signedPrekey: {
        keyId: string;
        publicKey: string;
        signature: string;
        isFallback: boolean;
      };
    }>
  > {
    const devices = await this.prisma.device.findMany({
      where: { userId: targetUserId, revokedAt: null },
      select: {
        id: true,
        identityKeyCurve25519: true,
        identityKeyEd25519: true,
      },
    });

    const results: Array<{
      deviceId: string;
      identityKeyCurve25519: string;
      identityKeyEd25519: string;
      signedPrekey: {
        keyId: string;
        publicKey: string;
        signature: string;
        isFallback: boolean;
      };
    }> = [];

    for (const device of devices) {
      const claimed = await this.tryClaimOtk(device.id);
      if (claimed) {
        results.push({
          deviceId: device.id,
          identityKeyCurve25519: device.identityKeyCurve25519,
          identityKeyEd25519: device.identityKeyEd25519,
          signedPrekey: { ...claimed, isFallback: false },
        });
        continue;
      }
      const fallback = await this.prisma.deviceFallbackKey.findFirst({
        where: { deviceId: device.id, retiredAt: null },
        orderBy: { createdAt: 'desc' },
        select: { keyId: true, publicKey: true, signature: true },
      });
      if (!fallback) {
        this.logger.warn(
          `claimKeys: device ${device.id} has no OTK or fallback key`,
        );
        continue;
      }
      results.push({
        deviceId: device.id,
        identityKeyCurve25519: device.identityKeyCurve25519,
        identityKeyEd25519: device.identityKeyEd25519,
        signedPrekey: { ...fallback, isFallback: true },
      });
    }

    return results;
  }

  /**
   * Atomically claim one unclaimed OTK. Uses a CTE-backed `UPDATE ... RETURNING`
   * so two concurrent callers can never both observe the same row as available.
   */
  private async tryClaimOtk(deviceId: string): Promise<{
    keyId: string;
    publicKey: string;
    signature: string;
  } | null> {
    type Row = { keyId: string; publicKey: string; signature: string };
    const rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
      UPDATE "DeviceOneTimeKey"
         SET "claimedAt" = NOW()
       WHERE "id" = (
         SELECT "id"
           FROM "DeviceOneTimeKey"
          WHERE "deviceId" = ${deviceId}
            AND "claimedAt" IS NULL
          ORDER BY "createdAt" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
       )
      RETURNING "keyId", "publicKey", "signature";
    `);
    return rows[0] ?? null;
  }

  async assertDeviceOwnedByUser(
    deviceId: string,
    userId: string,
  ): Promise<{ id: string }> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true, userId: true, revokedAt: true },
    });
    if (!device || device.userId !== userId || device.revokedAt) {
      throw new ForbiddenException('Device is not owned by caller or revoked');
    }
    return { id: device.id };
  }

  private toPublic(device: {
    id: string;
    userId: string;
    label: string;
    identityKeyCurve25519: string;
    identityKeyEd25519: string;
    createdAt: Date;
    lastSeenAt: Date;
    revokedAt: Date | null;
  }): PublicDeviceSummary {
    return {
      id: device.id,
      userId: device.userId,
      label: device.label,
      identityKeyCurve25519: device.identityKeyCurve25519,
      identityKeyEd25519: device.identityKeyEd25519,
      createdAt: device.createdAt,
      lastSeenAt: device.lastSeenAt,
      revokedAt: device.revokedAt,
    };
  }
}
