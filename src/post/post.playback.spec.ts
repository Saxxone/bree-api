import { Test, TestingModule } from '@nestjs/testing';
import { FileTranscodeStatus, Status as FileStatus } from '@prisma/client';
import { CoinPricingService } from 'src/coins/coin-pricing.service';
import { StreamMonetizationService } from 'src/coins/stream-monetization.service';
import { FileService } from 'src/file/file.service';
import { NotificationService } from 'src/notification/notification.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PostService } from './post.service';

describe('PostService playback URLs', () => {
  let postService: PostService;
  const oldApiBase = process.env.API_BASE_URL;

  beforeAll(() => {
    process.env.API_BASE_URL = 'http://api.test';
    process.env.VIDEO_DIRECT_PLAYBACK_MAX_BYTES = String(25 * 1024 * 1024);
  });

  afterAll(() => {
    process.env.API_BASE_URL = oldApiBase;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostService,
        { provide: PrismaService, useValue: {} },
        { provide: FileService, useValue: {} },
        { provide: NotificationService, useValue: {} },
        { provide: StreamMonetizationService, useValue: {} },
        { provide: CoinPricingService, useValue: {} },
      ],
    }).compile();

    postService = module.get(PostService);
  });

  it('uses stream URL for large video when mediaTypes is empty but file.type is video', () => {
    const mediaPath = '/media/uploads/big.mp4';
    const fileId = 'file-id-1';
    const fileByUrl = new Map([
      [
        mediaPath,
        {
          id: fileId,
          type: 'video',
          mimetype: 'video/mp4',
          size: 30 * 1024 * 1024,
          originalname: 'big.mp4',
          filename: 'stored-big.mp4',
          url: mediaPath,
          status: FileStatus.UPLOADED,
          trailerFilename: null,
          trailerUrl: null,
          r2MainKey: null,
          r2ManifestKey: null,
          transcodeStatus: FileTranscodeStatus.NOT_APPLICABLE,
        },
      ],
    ]);

    const svc = postService as unknown as {
      buildMediaPlaybackAndMetadata: (
        media: string[],
        mediaTypes: string[],
        fileByUrl: Map<string, unknown>,
        lockedFileIds: Set<string>,
        postMonetization: { enabled: boolean; pricedCostMinor: number | null },
      ) => { mediaPlayback: string[] };
    };

    const { mediaPlayback } = svc.buildMediaPlaybackAndMetadata.call(
      postService,
      [mediaPath],
      [],
      fileByUrl as Map<string, never>,
      new Set(),
      { enabled: false, pricedCostMinor: null },
    );

    expect(mediaPlayback[0]).toBe(`http://api.test/api/file/stream/${fileId}`);
  });

  it('uses direct media URL for image file even when mediaTypes wrongly says video', () => {
    const mediaPath = '/media/uploads/pic.jpg';
    const fileByUrl = new Map([
      [
        mediaPath,
        {
          id: 'f-img',
          type: 'image',
          mimetype: 'image/jpeg',
          size: 500,
          originalname: 'pic.jpg',
          filename: 'stored.jpg',
          url: mediaPath,
          status: FileStatus.UPLOADED,
          trailerFilename: null,
          trailerUrl: null,
          r2MainKey: null,
          r2ManifestKey: null,
          transcodeStatus: FileTranscodeStatus.NOT_APPLICABLE,
        },
      ],
    ]);

    const svc = postService as unknown as {
      buildMediaPlaybackAndMetadata: (
        media: string[],
        mediaTypes: string[],
        fileByUrl: Map<string, unknown>,
        lockedFileIds: Set<string>,
        postMonetization: { enabled: boolean; pricedCostMinor: number | null },
      ) => { mediaPlayback: string[] };
    };

    const { mediaPlayback } = svc.buildMediaPlaybackAndMetadata.call(
      postService,
      [mediaPath],
      ['video'],
      fileByUrl as Map<string, never>,
      new Set(),
      { enabled: false, pricedCostMinor: null },
    );

    expect(mediaPlayback[0]).toBe('http://api.test/api/file/media/stored.jpg');
  });

  it('sets requiresAuth on small direct video when post is monetized', () => {
    const mediaPath = '/media/uploads/small.mp4';
    const fileByUrl = new Map([
      [
        mediaPath,
        {
          id: 'f-vid',
          type: 'video',
          mimetype: 'video/mp4',
          size: 1024 * 1024,
          originalname: 'small.mp4',
          filename: 'stored-small.mp4',
          url: mediaPath,
          status: FileStatus.UPLOADED,
          trailerFilename: null,
          trailerUrl: null,
          r2MainKey: null,
          r2ManifestKey: null,
          transcodeStatus: FileTranscodeStatus.NOT_APPLICABLE,
        },
      ],
    ]);

    const svc = postService as unknown as {
      buildMediaPlaybackAndMetadata: (
        media: string[],
        mediaTypes: string[],
        fileByUrl: Map<string, unknown>,
        lockedFileIds: Set<string>,
        postMonetization: { enabled: boolean; pricedCostMinor: number | null },
      ) => {
        mediaPlayback: string[];
        mediaMetadata: Array<{
          requiresAuth: boolean;
          monetizationEnabled?: boolean;
          pricedCostMinor?: number | null;
          paywalled?: boolean;
        }>;
      };
    };

    const pricedCostMinor = 4_200;
    const { mediaPlayback, mediaMetadata } =
      svc.buildMediaPlaybackAndMetadata.call(
        postService,
        [mediaPath],
        [],
        fileByUrl as Map<string, never>,
        new Set(),
        { enabled: true, pricedCostMinor },
      );

    expect(mediaPlayback[0]).toBe(
      'http://api.test/api/file/media/stored-small.mp4',
    );
    expect(mediaMetadata[0].requiresAuth).toBe(true);
    expect(mediaMetadata[0].monetizationEnabled).toBe(true);
    expect(mediaMetadata[0].pricedCostMinor).toBe(pricedCostMinor);
    expect(mediaMetadata[0].paywalled).toBe(false);
  });

  it('includes paywall + coin meta on locked monetized video', () => {
    const mediaPath = '/media/uploads/small.mp4';
    const fileId = 'f-vid';
    const fileByUrl = new Map([
      [
        mediaPath,
        {
          id: fileId,
          type: 'video',
          mimetype: 'video/mp4',
          size: 1024 * 1024,
          originalname: 'small.mp4',
          filename: 'stored-small.mp4',
          url: mediaPath,
          status: FileStatus.UPLOADED,
          trailerFilename: null,
          trailerUrl: null,
          r2MainKey: null,
          r2ManifestKey: null,
          transcodeStatus: FileTranscodeStatus.NOT_APPLICABLE,
        },
      ],
    ]);

    const svc = postService as unknown as {
      buildMediaPlaybackAndMetadata: (
        media: string[],
        mediaTypes: string[],
        fileByUrl: Map<string, unknown>,
        lockedFileIds: Set<string>,
        postMonetization: { enabled: boolean; pricedCostMinor: number | null },
      ) => {
        mediaPlayback: string[];
        mediaMetadata: Array<{
          paywalled?: boolean;
          monetizationEnabled?: boolean;
          pricedCostMinor?: number | null;
        }>;
      };
    };

    const pricedCostMinor = 99;
    const { mediaPlayback, mediaMetadata } =
      svc.buildMediaPlaybackAndMetadata.call(
        postService,
        [mediaPath],
        [],
        fileByUrl as Map<string, never>,
        new Set([fileId]),
        { enabled: true, pricedCostMinor },
      );

    expect(mediaPlayback[0]).toBe('');
    expect(mediaMetadata[0].paywalled).toBe(true);
    expect(mediaMetadata[0].monetizationEnabled).toBe(true);
    expect(mediaMetadata[0].pricedCostMinor).toBe(pricedCostMinor);
  });

  it('includes trailerPlayback on locked monetized video when trailerFilename exists', () => {
    const mediaPath = '/media/uploads/small.mp4';
    const fileId = 'f-vid';
    const trailerFilename = 'small-trailer-abc.mp4';
    const fileByUrl = new Map([
      [
        mediaPath,
        {
          id: fileId,
          type: 'video',
          mimetype: 'video/mp4',
          size: 1024 * 1024,
          originalname: 'small.mp4',
          filename: 'stored-small.mp4',
          url: mediaPath,
          status: FileStatus.UPLOADED,
          trailerFilename,
          trailerUrl: `http://api.test/api/file/media/${trailerFilename}`,
          r2MainKey: null,
          r2ManifestKey: null,
          transcodeStatus: FileTranscodeStatus.NOT_APPLICABLE,
        },
      ],
    ]);

    const svc = postService as unknown as {
      buildMediaPlaybackAndMetadata: (
        media: string[],
        mediaTypes: string[],
        fileByUrl: Map<string, unknown>,
        lockedFileIds: Set<string>,
        postMonetization: { enabled: boolean; pricedCostMinor: number | null },
      ) => {
        mediaPlayback: string[];
        mediaMetadata: Array<{
          paywalled?: boolean;
          trailerPlayback?: string | null;
        }>;
      };
    };

    const { mediaMetadata } = svc.buildMediaPlaybackAndMetadata.call(
      postService,
      [mediaPath],
      [],
      fileByUrl as Map<string, never>,
      new Set([fileId]),
      { enabled: true, pricedCostMinor: 99 },
    );

    expect(mediaMetadata[0].paywalled).toBe(true);
    expect(mediaMetadata[0].trailerPlayback).toBe(
      `http://api.test/api/file/media/${encodeURIComponent(trailerFilename)}`,
    );
  });
});
