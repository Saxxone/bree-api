import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeviceService } from './device.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * These specs exercise the OTK-claim code path, which is the most
 * concurrency-sensitive part of the Device module. We stub `$queryRaw` to
 * simulate the two outcomes of the atomic `UPDATE ... RETURNING`:
 *   - it returned exactly one row, meaning the caller reserved an OTK;
 *   - it returned zero rows, meaning the pool is empty and the caller must
 *     fall back to the device's long-lived fallback key.
 *
 * We also assert that `claimKeys` never yields the same OTK twice across
 * concurrent invocations by having the stub serve each row at most once.
 */

describe('DeviceService.claimKeys', () => {
  let service: DeviceService;
  let prisma: {
    device: { findMany: jest.Mock };
    deviceFallbackKey: { findFirst: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      device: { findMany: jest.fn() },
      deviceFallbackKey: { findFirst: jest.fn() },
      $queryRaw: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(DeviceService);
  });

  it('returns OTK-backed bundles when atomic claim succeeds', async () => {
    prisma.device.findMany.mockResolvedValue([
      {
        id: 'device-a',
        identityKeyCurve25519: 'curve-a',
        identityKeyEd25519: 'ed-a',
      },
    ]);
    prisma.$queryRaw.mockResolvedValue([
      { keyId: 'otk-1', publicKey: 'pk-1', signature: 'sig-1' },
    ]);

    const result = await service.claimKeys('target-user');

    expect(result).toHaveLength(1);
    expect(result[0].signedPrekey.isFallback).toBe(false);
    expect(result[0].signedPrekey.keyId).toBe('otk-1');
    expect(prisma.deviceFallbackKey.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to the signed fallback key when the OTK pool is empty', async () => {
    prisma.device.findMany.mockResolvedValue([
      {
        id: 'device-b',
        identityKeyCurve25519: 'curve-b',
        identityKeyEd25519: 'ed-b',
      },
    ]);
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.deviceFallbackKey.findFirst.mockResolvedValue({
      keyId: 'fb-1',
      publicKey: 'fb-pk',
      signature: 'fb-sig',
    });

    const result = await service.claimKeys('target-user');

    expect(result).toHaveLength(1);
    expect(result[0].signedPrekey.isFallback).toBe(true);
    expect(result[0].signedPrekey.keyId).toBe('fb-1');
  });

  it('skips devices that have neither an OTK nor a fallback key', async () => {
    prisma.device.findMany.mockResolvedValue([
      {
        id: 'device-c',
        identityKeyCurve25519: 'curve-c',
        identityKeyEd25519: 'ed-c',
      },
      {
        id: 'device-d',
        identityKeyCurve25519: 'curve-d',
        identityKeyEd25519: 'ed-d',
      },
    ]);
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { keyId: 'otk-d', publicKey: 'pk-d', signature: 'sig-d' },
      ]);
    prisma.deviceFallbackKey.findFirst.mockResolvedValueOnce(null);

    const result = await service.claimKeys('target-user');

    expect(result).toHaveLength(1);
    expect(result[0].deviceId).toBe('device-d');
  });

  it('does not hand out the same OTK to two concurrent callers', async () => {
    prisma.device.findMany.mockResolvedValue([
      {
        id: 'device-e',
        identityKeyCurve25519: 'curve-e',
        identityKeyEd25519: 'ed-e',
      },
    ]);

    // Simulate Postgres `FOR UPDATE SKIP LOCKED`: first caller claims the row,
    // second caller sees an empty result set.
    const rows = [[{ keyId: 'otk-unique', publicKey: 'pk', signature: 'sig' }]];
    prisma.$queryRaw.mockImplementation(() =>
      Promise.resolve(rows.shift() ?? []),
    );
    prisma.deviceFallbackKey.findFirst.mockResolvedValue({
      keyId: 'fb',
      publicKey: 'fb-pk',
      signature: 'fb-sig',
    });

    const [first, second] = await Promise.all([
      service.claimKeys('target-user'),
      service.claimKeys('target-user'),
    ]);

    const firstKey = first[0].signedPrekey.keyId;
    const secondKey = second[0].signedPrekey.keyId;
    expect([firstKey, secondKey].sort()).toEqual(['fb', 'otk-unique']);
    expect(firstKey).not.toBe(secondKey);
  });
});
