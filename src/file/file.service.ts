import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  Status,
  File as FileModel,
  StreamQuality,
  FileTranscodeStatus,
  FilePlaybackKind,
} from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs/promises';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';
import { UpdateFileDto } from './dto/update-file.dto';
import { mediaFilePublicUrl, resolveFileBaseUrl } from './media-storage';
import { isR2ObjectStoreEnabled } from './media-object-store';
import { R2StorageService } from './r2-storage.service';
import { resolveDiskPathForFile } from './file-path.util';
import {
  dimensionsToStreamQuality,
  extractFilenameFromMediaUrl,
  probeVideoFile,
} from './video-probe';
import { generateVideoTrailer } from './video-trailer';

export type FileMediaLookup = {
  file: FileModel;
  /** When true, serve `trailerPath` as MP4 instead of the main asset. */
  serveTrailer: boolean;
};

function parseTrailerBackfillEnabled(): boolean {
  const raw = process.env.TRAILER_BACKFILL_ENABLED?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'no') {
    return false;
  }
  return true;
}

function parseTrailerBackfillBatch(): number {
  const n = parseInt(process.env.TRAILER_BACKFILL_BATCH ?? '5', 10);
  if (!Number.isFinite(n) || n < 1) {
    return 5;
  }
  return Math.min(n, 50);
}

/** When true, backfill selects videos that already have a trailer and replaces them (CLI / ops only). */
function parseTrailerBackfillOverride(): boolean {
  const raw = process.env.TRAILER_BACKFILL_OVERRIDE?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

@Injectable()
export class FileService {
  constructor(
    private readonly userService: UserService,
    private readonly prisma: PrismaService,
    private readonly r2Storage: R2StorageService,
    @InjectQueue('video-transcode') private readonly videoTranscodeQueue: Queue,
  ) {}

  private readonly logger = new Logger();

  @Cron(CronExpression.EVERY_DAY_AT_11PM)
  async handleCron() {
    this.logger.log('remove orphaned files every day at 11pm');

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setDate(twentyFourHoursAgo.getDate() - 1);

    const pendingFiles = await this.prisma.file.findMany({
      where: {
        status: Status.PENDING,
        createdAt: {
          lt: twentyFourHoursAgo,
        },
      },
    });
    await this.deleteFilesAndRecords(pendingFiles);
  }

  /** Hourly: generate trailers for older video rows that lack one. */
  @Cron('0 0 * * * *')
  async handleTrailerBackfillCron(): Promise<void> {
    if (!parseTrailerBackfillEnabled()) {
      return;
    }
    await this.runTrailerBackfillJob({ overrideExisting: false });
  }

  /**
   * One batch of trailer generation (ffprobe-backed duration + ffmpeg clip).
   * Same work as the scheduled job but ignores `TRAILER_BACKFILL_ENABLED` — use from CLI / ops.
   *
   * @param opts.overrideExisting When set, forces that behavior. When omitted, uses env `TRAILER_BACKFILL_OVERRIDE` (CLI jobs only — cron passes `false`).
   */
  async runTrailerBackfillJob(opts?: {
    overrideExisting?: boolean;
  }): Promise<{ candidateCount: number }> {
    const batch = parseTrailerBackfillBatch();
    const overrideExisting =
      opts?.overrideExisting !== undefined
        ? opts.overrideExisting
        : parseTrailerBackfillOverride();
    if (overrideExisting) {
      this.logger.warn(
        'TRAILER_BACKFILL_OVERRIDE is on: regenerating trailers even when one already exists (remove from .env when done).',
      );
    }
    /**
     * Raw query avoids `FileWhereInput` until Prisma client is regenerated after schema changes.
     * Duration is intentionally not required here: `ensureVideoTrailerForFileId` re-probes and
     * persists `videoDurationSeconds` on the fly when it is NULL, so filtering it out would leave
     * never-probed legacy uploads permanently stuck without a trailer.
     */
    const candidates = overrideExisting
      ? await this.prisma.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`
        SELECT id
        FROM "File"
        WHERE type = 'video'
          AND "deletedAt" IS NULL
          AND status IN ('PENDING'::"Status", 'UPLOADED'::"Status")
        ORDER BY "createdAt" ASC
        LIMIT ${batch}
      `,
        )
      : await this.prisma.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`
        SELECT id
        FROM "File"
        WHERE type = 'video'
          AND "deletedAt" IS NULL
          AND status IN ('PENDING'::"Status", 'UPLOADED'::"Status")
          AND "trailerFilename" IS NULL
        ORDER BY "createdAt" ASC
        LIMIT ${batch}
      `,
        );
    for (const row of candidates) {
      await this.ensureVideoTrailerForFileId(row.id, {
        overrideExisting: overrideExisting,
      }).catch((err) => {
        this.logger.warn(`Trailer backfill failed for file ${row.id}: ${err}`);
      });
    }
    if (candidates.length > 0) {
      this.logger.log(
        `Trailer backfill processed up to ${candidates.length} file(s)`,
      );
    }
    return { candidateCount: candidates.length };
  }

  private async deleteFilesAndRecords(files: Array<FileModel>) {
    for (const file of files) {
      try {
        if (file.trailerPath) {
          try {
            await fs.unlink(this.resolveDiskPathForProbe(file.trailerPath));
          } catch {
            /* ignore missing trailer on disk */
          }
        }
        if (file.path) {
          await fs.unlink(file.path);
          console.log(`File deleted from storage: ${file.path}`);
        }

        // 2. Delete (or update) the database record
        await this.prisma.file.update({
          where: { id: file.id, status: Status.PENDING },
          data: { status: Status.DELETED },
        });
      } catch (error) {
        console.error(`Error deleting file ${file.path}:`, error);
      }
    }
  }

  async create(
    files: Array<Express.Multer.File>,
    email: string,
  ): Promise<string[]> {
    const user = await this.userService.findUser(email);
    const savedFiles: string[] = [];
    const media_base_url = resolveFileBaseUrl();

    for (const file of files) {
      const r2VideoPipeline =
        isR2ObjectStoreEnabled() &&
        Boolean(this.r2Storage.getConfig()) &&
        file.mimetype.startsWith('video/');
      const savedFile = await this.prisma.file.create({
        data: {
          filename: file.filename,
          originalname: file.originalname,
          path: file.path,
          url: r2VideoPipeline
            ? mediaFilePublicUrl(file.filename)
            : media_base_url + file.filename,
          mimetype: file.mimetype,
          size: file.size,
          status: Status.PENDING,
          type: file.mimetype.split('/')[0],
          transcodeStatus: r2VideoPipeline
            ? FileTranscodeStatus.PENDING
            : FileTranscodeStatus.NOT_APPLICABLE,
          owner: {
            connect: { id: user.id },
          },
        },
      });
      if (savedFile.type === 'video') {
        void this.probeAndPersistVideoMetadata(savedFile.id, savedFile.path!)
          .then((meta) => {
            if (meta) {
              if (!r2VideoPipeline) {
                void this.ensureVideoTrailerForFileId(savedFile.id).catch(
                  (err) => {
                    this.logger.warn(
                      `Video trailer failed for file ${savedFile.id}: ${err}`,
                    );
                  },
                );
              }
            }
          })
          .catch((err) => {
            this.logger.warn(
              `Video probe failed for file ${savedFile.id}: ${err}`,
            );
          });
      }
      savedFiles.push(savedFile.id);
    }

    return savedFiles;
  }

  async getFilesUrls(
    fileIds: string[] | Prisma.PostCreatemediaInput[],
  ): Promise<{ url: string; type: string }[]> {
    return await Promise.all(
      fileIds.map(async (fileId) => {
        const file = await this.prisma.file.findUnique({
          where: {
            id: fileId,
            status: { in: [Status.PENDING, Status.UPLOADED] },
          },
        });

        if (!file) {
          throw new NotFoundException('File not found');
        }

        return { url: file.url, type: file.type };
      }),
    );
  }

  async markFileAsUploaded(fileIds: string[]) {
    return Promise.all(
      fileIds.map(async (fileId) => {
        const file = await this.prisma.file.update({
          where: { id: fileId },
          data: { status: Status.UPLOADED },
        });

        if (!file) {
          throw new NotFoundException('File not found');
        }

        if (file.type === 'video' && file.path) {
          try {
            const meta = await this.probeAndPersistVideoMetadata(
              file.id,
              file.path,
            );
            if (meta) {
              const r2Pipeline =
                isR2ObjectStoreEnabled() &&
                Boolean(this.r2Storage.getConfig()) &&
                file.transcodeStatus === FileTranscodeStatus.PENDING;
              if (r2Pipeline) {
                await this.ensureVideoTrailerForFileId(file.id).catch((err) => {
                  this.logger.warn(
                    `Video trailer failed after upload for file ${file.id}: ${err}`,
                  );
                });
                await this.videoTranscodeQueue.add(
                  'transcode',
                  { fileId: file.id },
                  {
                    removeOnComplete: true,
                    attempts: 2,
                    backoff: { type: 'exponential', delay: 10_000 },
                  },
                );
              } else {
                void this.ensureVideoTrailerForFileId(file.id).catch((err) => {
                  this.logger.warn(
                    `Video trailer failed after upload for file ${file.id}: ${err}`,
                  );
                });
              }
            }
          } catch (err) {
            this.logger.warn(
              `Video probe failed after upload for file ${file.id}: ${err}`,
            );
          }
        }

        return file.status;
      }),
    );
  }

  /**
   * ffprobe the file on disk and persist width/height/duration for video pricing.
   */
  private resolveDiskPathForProbe(
    storedPath: string | null | undefined,
  ): string {
    return resolveDiskPathForFile(storedPath);
  }

  async probeAndPersistVideoMetadata(
    fileId: string,
    absolutePath: string,
  ): Promise<{
    width: number;
    height: number;
    durationSeconds: number;
  } | null> {
    const diskPath = this.resolveDiskPathForProbe(absolutePath);
    if (!diskPath) {
      return null;
    }
    const result = await probeVideoFile(diskPath);
    if (!result) {
      this.logger.warn(
        `ffprobe returned no metadata for file ${fileId} at ${diskPath} (check FFPROBE_PATH / ffmpeg install)`,
      );
      return null;
    }
    await this.prisma.file.update({
      where: { id: fileId },
      data: {
        videoWidth: result.width,
        videoHeight: result.height,
        videoDurationSeconds: result.durationSeconds,
      },
    });
    return result;
  }

  /**
   * Encode first ~10s (or full length if shorter) to MP4 and persist trailer fields.
   * No-op if not a video, already has a trailer (unless {@link opts.overrideExisting}), or source is missing / not probeable.
   */
  private async ensureVideoTrailerForFileId(
    fileId: string,
    opts?: { overrideExisting?: boolean },
  ): Promise<void> {
    const override = opts?.overrideExisting === true;
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (
      !file ||
      file.type !== 'video' ||
      file.deletedAt != null ||
      file.status === Status.DELETED ||
      (!override && file.trailerFilename)
    ) {
      return;
    }

    if (!file.path?.trim()) {
      return;
    }

    const sourceDisk = this.resolveDiskPathForProbe(file.path);
    const previousTrailerPath = override ? file.trailerPath : null;

    try {
      await fs.access(sourceDisk);
    } catch {
      this.logger.warn(`Trailer skipped, source missing for ${fileId}`);
      return;
    }

    let durationSeconds = file.videoDurationSeconds;
    if (durationSeconds == null || durationSeconds <= 0) {
      const probed = await this.probeAndPersistVideoMetadata(fileId, file.path);
      durationSeconds = probed?.durationSeconds ?? null;
    }
    if (durationSeconds == null || durationSeconds <= 0) {
      this.logger.warn(`Trailer skipped, no duration for ${fileId}`);
      return;
    }

    const stem =
      (file.filename && file.filename.replace(/\.[^/.]+$/, '')) ||
      `video-${fileId.slice(0, 8)}`;
    const trailerFilename = `${stem}-trailer-${randomBytes(8).toString('hex')}.mp4`;
    const trailerPath = join(dirname(sourceDisk), trailerFilename);
    const trailerUrl = mediaFilePublicUrl(trailerFilename);

    await generateVideoTrailer(sourceDisk, trailerPath, {
      durationSeconds,
      maxSeconds: 10,
    });

    const updated = await this.prisma.file.updateMany({
      where: override ? { id: fileId } : { id: fileId, trailerFilename: null },
      data: { trailerFilename, trailerPath, trailerUrl },
    });
    if (updated.count === 0) {
      await fs.unlink(trailerPath).catch(() => {
        /* ignore */
      });
      return;
    }
    if (
      override &&
      previousTrailerPath &&
      previousTrailerPath !== trailerPath
    ) {
      try {
        await fs.unlink(this.resolveDiskPathForProbe(previousTrailerPath));
      } catch {
        /* ignore missing previous trailer */
      }
    }
  }

  private static streamQualityRank(q: StreamQuality): number {
    const r: Record<StreamQuality, number> = { P720: 1, P1080: 2, P4K: 3 };
    return r[q];
  }

  private static maxStreamQuality(
    a: StreamQuality,
    b: StreamQuality,
  ): StreamQuality {
    return FileService.streamQualityRank(a) >= FileService.streamQualityRank(b)
      ? a
      : b;
  }

  /**
   * Sum durations and take the highest resolution tier across all video files
   * referenced by URL/path (for fixed post pricing).
   */
  async aggregateVideoMonetizationInputs(
    urls: string[],
    ownerUserId?: string,
  ): Promise<{
    totalDurationSeconds: number;
    sourceStreamQuality: StreamQuality;
  } | null> {
    const unique = [...new Set(urls.filter(Boolean))];
    if (unique.length === 0) {
      return null;
    }

    const filenames = [
      ...new Set(
        unique
          .map((u) => extractFilenameFromMediaUrl(u))
          .filter((f): f is string => !!f),
      ),
    ];

    const urlOrPathMatch: Prisma.FileWhereInput[] = [
      { url: { in: unique } },
      { path: { in: unique } },
    ];
    if (filenames.length > 0 && ownerUserId) {
      urlOrPathMatch.push({
        filename: { in: filenames },
        ownerId: ownerUserId,
      });
    }

    const files = await this.prisma.file.findMany({
      where: {
        AND: [
          { OR: urlOrPathMatch },
          {
            OR: [{ type: 'video' }, { mimetype: { startsWith: 'video/' } }],
          },
          { status: { not: Status.DELETED } },
        ],
      },
      select: {
        id: true,
        path: true,
        videoWidth: true,
        videoHeight: true,
        videoDurationSeconds: true,
      },
    });

    const deduped = [...new Map(files.map((f) => [f.id, f])).values()];
    if (deduped.length === 0) {
      this.logger.warn(
        `aggregateVideoMonetizationInputs: no video File rows for urls=${JSON.stringify(unique.slice(0, 3))}${unique.length > 3 ? '…' : ''} owner=${ownerUserId ?? 'n/a'}`,
      );
      return null;
    }

    let totalDuration = 0;
    let quality: StreamQuality = StreamQuality.P720;

    for (const f of deduped) {
      let w = f.videoWidth;
      let h = f.videoHeight;
      let d = f.videoDurationSeconds;
      if (w == null || h == null || d == null) {
        if (!f.path) {
          continue;
        }
        const probed = await this.probeAndPersistVideoMetadata(f.id, f.path);
        if (probed) {
          w = probed.width;
          h = probed.height;
          d = probed.durationSeconds;
        }
      }
      if (w != null && h != null && d != null && d > 0) {
        totalDuration += d;
        quality = FileService.maxStreamQuality(
          quality,
          dimensionsToStreamQuality(w, h),
        );
      }
    }

    if (totalDuration <= 0) {
      this.logger.warn(
        `aggregateVideoMonetizationInputs: ${deduped.length} file(s) found but duration/geometry still missing after ffprobe`,
      );
      return null;
    }
    return {
      totalDurationSeconds: totalDuration,
      sourceStreamQuality: quality,
    };
  }

  findAll() {
    return `This action returns all file`;
  }

  async findForStream(id: string): Promise<FileModel> {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file || file.status === Status.DELETED) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  async findForStreamByFilename(rawName: string): Promise<FileMediaLookup> {
    if (
      !rawName ||
      rawName.includes('/') ||
      rawName.includes('\\') ||
      rawName === '.' ||
      rawName === '..'
    ) {
      throw new BadRequestException('Invalid filename');
    }
    const candidates = FileService.filenameLookupCandidates(rawName);
    for (const name of candidates) {
      const main = await this.prisma.file.findFirst({
        where: {
          filename: name,
          status: { not: Status.DELETED },
        },
      });
      if (main) {
        return { file: main, serveTrailer: false };
      }
      const trailerHit = await this.prisma.file.findFirst({
        where: {
          trailerFilename: name,
          status: { not: Status.DELETED },
        },
      });
      if (trailerHit) {
        return { file: trailerHit, serveTrailer: true };
      }
    }
    throw new NotFoundException('File not found');
  }

  /** Absolute path and Content-Type for GET/HEAD /file/media/:filename (main or trailer). */
  resolveMediaDiskPathAndMime(lookup: FileMediaLookup): {
    absolutePath: string;
    mimetype: string;
  } {
    if (lookup.serveTrailer) {
      const { file } = lookup;
      if (!file.trailerPath || !file.trailerFilename) {
        throw new NotFoundException('Trailer not found');
      }
      return {
        absolutePath: this.resolveDiskPathForProbe(file.trailerPath),
        mimetype: 'video/mp4',
      };
    }
    if (!lookup.file.path?.trim()) {
      throw new NotFoundException('File not found on disk');
    }
    return {
      absolutePath: this.resolveDiskPathForProbe(lookup.file.path),
      mimetype: lookup.file.mimetype,
    };
  }

  /**
   * Express decodes path params, but clients may still send over-escaped names
   * (e.g. %2520). Try a few safe variants so /file/media/* matches /file/stream/:id.
   */
  private static filenameLookupCandidates(rawName: string): string[] {
    const trimmed = rawName.trim();
    const out: string[] = [];
    const add = (s: string) => {
      if (s && !out.includes(s)) {
        out.push(s);
      }
    };
    add(trimmed);
    if (trimmed.includes('%')) {
      try {
        add(decodeURIComponent(trimmed));
      } catch {
        /* ignore */
      }
    }
    return out;
  }

  /** Row fields needed for post playback URLs and video metadata. */
  async findFilesByUrls(urls: string[]): Promise<
    Map<
      string,
      {
        id: string;
        type: string;
        mimetype: string;
        size: number;
        originalname: string;
        filename: string;
        url: string;
        status: Status;
        videoWidth: number | null;
        videoHeight: number | null;
        videoDurationSeconds: number | null;
        trailerFilename: string | null;
        trailerUrl: string | null;
        r2MainKey: string | null;
        r2ManifestKey: string | null;
        transcodeStatus: FileTranscodeStatus;
        playbackKind: FilePlaybackKind | null;
      }
    >
  > {
    const unique = [...new Set(urls.filter(Boolean))];
    if (unique.length === 0) {
      return new Map();
    }
    const files = await this.prisma.file.findMany({
      where: {
        OR: [{ url: { in: unique } }, { path: { in: unique } }],
        status: { in: [Status.UPLOADED, Status.PENDING] },
      },
      select: {
        id: true,
        url: true,
        path: true,
        type: true,
        mimetype: true,
        size: true,
        originalname: true,
        filename: true,
        status: true,
        videoWidth: true,
        videoHeight: true,
        videoDurationSeconds: true,
        trailerFilename: true,
        trailerUrl: true,
        r2MainKey: true,
        r2ManifestKey: true,
        transcodeStatus: true,
        playbackKind: true,
      },
    });
    type Row = {
      id: string;
      type: string;
      mimetype: string;
      size: number;
      originalname: string;
      filename: string;
      url: string;
      status: Status;
      videoWidth: number | null;
      videoHeight: number | null;
      videoDurationSeconds: number | null;
      trailerFilename: string | null;
      trailerUrl: string | null;
      r2MainKey: string | null;
      r2ManifestKey: string | null;
      transcodeStatus: FileTranscodeStatus;
      playbackKind: FilePlaybackKind | null;
    };
    const map = new Map<string, Row>();
    for (const f of files) {
      const row: Row = {
        id: f.id,
        type: f.type,
        mimetype: f.mimetype,
        size: f.size,
        originalname: f.originalname,
        filename: f.filename,
        url: f.url,
        status: f.status,
        videoWidth: f.videoWidth,
        videoHeight: f.videoHeight,
        videoDurationSeconds: f.videoDurationSeconds,
        trailerFilename: f.trailerFilename,
        trailerUrl: f.trailerUrl,
        r2MainKey: f.r2MainKey,
        r2ManifestKey: f.r2ManifestKey,
        transcodeStatus: f.transcodeStatus,
        playbackKind: f.playbackKind,
      };
      map.set(f.url, row);
      map.set(f.path, row);
    }
    return map;
  }

  assertStreamAccess(
    file: FileModel,
    user: { userId?: string } | undefined,
  ): void {
    // Match GET /api/file/media/:filename — public UPLOADED files need no user.
    if (file.status === Status.UPLOADED) {
      return;
    }
    if (!user?.userId) {
      throw new ForbiddenException();
    }
    if (file.ownerId === user.userId) {
      return;
    }
    throw new ForbiddenException();
  }

  findOne(id: string) {
    return `This action returns a #${id} file`;
  }

  update(id: string, updateFileDto: UpdateFileDto) {
    return `This action updates a #${id} file ${updateFileDto}`;
  }

  remove(id: string) {
    return `This action removes a #${id} file`;
  }
}
