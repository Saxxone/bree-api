import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Status, File as FileModel, StreamQuality } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs/promises';
import { resolve, isAbsolute } from 'path';
import { UpdateFileDto } from './dto/update-file.dto';
import { getMediaStorageDir, resolveFileBaseUrl } from './media-storage';
import {
  dimensionsToStreamQuality,
  extractFilenameFromMediaUrl,
  probeVideoFile,
} from './video-probe';

@Injectable()
export class FileService {
  constructor(
    private readonly userService: UserService,
    private readonly prisma: PrismaService,
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

  private async deleteFilesAndRecords(files: Array<FileModel>) {
    for (const file of files) {
      try {
        await fs.unlink(file.path);
        console.log(`File deleted from storage: ${file.path}`);

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
      const savedFile = await this.prisma.file.create({
        data: {
          filename: file.filename,
          originalname: file.originalname,
          path: file.path,
          url: media_base_url + file.filename,
          mimetype: file.mimetype,
          size: file.size,
          status: Status.PENDING,
          type: file.mimetype.split('/')[0],
          owner: {
            connect: { id: user.id },
          },
        } as Prisma.FileCreateInput,
      });
      if (savedFile.type === 'video') {
        await this.probeAndPersistVideoMetadata(savedFile.id, savedFile.path).catch(
          (err) => {
            this.logger.warn(
              `Video probe failed for file ${savedFile.id}: ${err}`,
            );
          },
        );
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

        if (file.type === 'video') {
          await this.probeAndPersistVideoMetadata(file.id, file.path).catch(
            (err) => {
              this.logger.warn(
                `Video probe failed after upload for file ${file.id}: ${err}`,
              );
            },
          );
        }

        return file.status;
      }),
    );
  }

  /**
   * ffprobe the file on disk and persist width/height/duration for video pricing.
   */
  private resolveDiskPathForProbe(storedPath: string): string {
    const trimmed = storedPath?.trim() ?? '';
    if (!trimmed) {
      return trimmed;
    }
    return isAbsolute(trimmed) ? resolve(trimmed) : resolve(getMediaStorageDir(), trimmed);
  }

  async probeAndPersistVideoMetadata(
    fileId: string,
    absolutePath: string,
  ): Promise<{ width: number; height: number; durationSeconds: number } | null> {
    const diskPath = this.resolveDiskPathForProbe(absolutePath);
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

  private static streamQualityRank(q: StreamQuality): number {
    const r: Record<StreamQuality, number> = { P720: 1, P1080: 2, P4K: 3 };
    return r[q];
  }

  private static maxStreamQuality(a: StreamQuality, b: StreamQuality): StreamQuality {
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

  async findForStreamByFilename(rawName: string): Promise<FileModel> {
    if (
      !rawName ||
      rawName.includes('/') ||
      rawName.includes('\\') ||
      rawName === '.' ||
      rawName === '..'
    ) {
      throw new BadRequestException('Invalid filename');
    }
    const file = await this.prisma.file.findFirst({
      where: {
        filename: rawName,
        status: { not: Status.DELETED },
      },
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return file;
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
    if (!user?.userId) {
      throw new ForbiddenException();
    }
    if (file.status === Status.UPLOADED) {
      return;
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
