import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FilePlaybackKind, FileTranscodeStatus, Status } from '@prisma/client';
import { readdir, rm, stat } from 'fs/promises';
import { join } from 'path';
import * as fs from 'fs/promises';
import { PrismaService } from 'src/prisma/prisma.service';
import { R2StorageService } from './r2-storage.service';
import {
  transcodeToHls,
  transcodeToPlaybackMp4,
} from './video-transcode-ffmpeg';
import { resolveDiskPathForFile } from './file-path.util';
import { isR2ObjectStoreEnabled } from './media-object-store';

const MIME_BY_EXT: Record<string, string> = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.mp4': 'video/mp4',
};

function contentTypeForName(name: string): string {
  const lower = name.toLowerCase();
  for (const [ext, mime] of Object.entries(MIME_BY_EXT)) {
    if (lower.endsWith(ext)) {
      return mime;
    }
  }
  return 'application/octet-stream';
}

@Processor('video-transcode')
export class VideoTranscodeProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoTranscodeProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2StorageService,
  ) {
    super();
  }

  async process(job: Job<{ fileId: string }>): Promise<void> {
    const fileId = job.data?.fileId;
    if (!fileId) {
      return;
    }
    if (!isR2ObjectStoreEnabled() || !this.r2.getConfig()) {
      this.logger.warn(
        'video-transcode skipped: R2 not enabled or not configured',
      );
      return;
    }

    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (
      !file ||
      file.deletedAt != null ||
      file.status === Status.DELETED ||
      file.type !== 'video' ||
      file.transcodeStatus !== FileTranscodeStatus.PENDING
    ) {
      return;
    }

    const sourcePath = file.path ? resolveDiskPathForFile(file.path) : null;
    if (!sourcePath) {
      await this.prisma.file.update({
        where: { id: fileId },
        data: { transcodeStatus: FileTranscodeStatus.FAILED },
      });
      return;
    }

    try {
      await fs.access(sourcePath);
    } catch {
      this.logger.warn(`video-transcode: missing source ${sourcePath}`);
      await this.prisma.file.update({
        where: { id: fileId },
        data: { transcodeStatus: FileTranscodeStatus.FAILED },
      });
      return;
    }

    const workRoot = await fs.mkdtemp(
      join(process.env.TMPDIR || '/tmp', 'afovid-transcode-'),
    );

    try {
      const hlsDir = join(workRoot, 'hls');
      await fs.mkdir(hlsDir, { recursive: true });
      await transcodeToHls(sourcePath, hlsDir);

      const playbackLocal = join(workRoot, 'playback.mp4');
      await transcodeToPlaybackMp4(sourcePath, playbackLocal);
      const playbackSize = (await stat(playbackLocal)).size;

      const prefix = `v/${fileId}`;
      const names = await readdir(hlsDir);
      for (const name of names) {
        const abs = join(hlsDir, name);
        const st = await stat(abs);
        if (!st.isFile()) {
          continue;
        }
        const key = `${prefix}/${name}`;
        await this.r2.putFileFromDisk(key, abs, contentTypeForName(name));
      }

      const playbackKey = `${prefix}/playback.mp4`;
      await this.r2.putFileFromDisk(playbackKey, playbackLocal, 'video/mp4');

      const manifestKey = `${prefix}/index.m3u8`;

      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          transcodeStatus: FileTranscodeStatus.READY,
          playbackKind: FilePlaybackKind.HLS,
          r2MainKey: playbackKey,
          r2ManifestKey: manifestKey,
          size: playbackSize,
          path: null,
        },
      });

      try {
        await fs.unlink(sourcePath);
      } catch (e) {
        this.logger.warn(`Could not delete local source after R2 upload: ${e}`);
      }
    } catch (err) {
      this.logger.error(`video-transcode failed for ${fileId}: ${err}`);
      await this.prisma.file.update({
        where: { id: fileId },
        data: { transcodeStatus: FileTranscodeStatus.FAILED },
      });
    } finally {
      await rm(workRoot, { recursive: true, force: true }).catch(() => {
        /* ignore */
      });
    }
  }
}
