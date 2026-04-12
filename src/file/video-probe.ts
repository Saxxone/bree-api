import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { StreamQuality } from '@prisma/client';
import { resolveFfprobePath } from './media-binary-path';

const execFileAsync = promisify(execFile);

export type VideoProbeResult = {
  width: number;
  height: number;
  durationSeconds: number;
};

/** Last path segment of a media URL (decoded), for matching `File.filename`. */
export function extractFilenameFromMediaUrl(url: string): string | null {
  try {
    const clean = url.trim().split('?')[0];
    const parts = clean.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (!last) {
      return null;
    }
    return decodeURIComponent(last);
  } catch {
    return null;
  }
}

/**
 * Map pixel dimensions to pricing tier (creator upload quality).
 * Uses the longer edge vs common HD/UHD thresholds.
 */
export function dimensionsToStreamQuality(
  width: number,
  height: number,
): StreamQuality {
  const longSide = Math.max(width, height);
  if (longSide >= 2160) {
    return StreamQuality.P4K;
  }
  if (longSide >= 1080) {
    return StreamQuality.P1080;
  }
  return StreamQuality.P720;
}

/**
 * Run ffprobe on a video file. Returns null if probing fails.
 */
export async function probeVideoFile(
  absolutePath: string,
): Promise<VideoProbeResult | null> {
  const ffprobe = resolveFfprobePath();
  try {
    const { stdout } = await execFileAsync(
      ffprobe,
      [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        absolutePath,
      ],
      { maxBuffer: 10 * 1024 * 1024 },
    );
    const parsed = JSON.parse(stdout) as {
      streams?: Array<{
        codec_type?: string;
        width?: number;
        height?: number;
      }>;
      format?: { duration?: string };
    };
    const videoStream = parsed.streams?.find((s) => s.codec_type === 'video');
    const width = videoStream?.width;
    const height = videoStream?.height;
    const durationRaw = parsed.format?.duration;
    const duration = durationRaw !== undefined ? parseFloat(durationRaw) : NaN;
    if (
      width === undefined ||
      height === undefined ||
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      return null;
    }
    return {
      width,
      height,
      durationSeconds: Math.max(1, Math.round(duration)),
    };
  } catch {
    return null;
  }
}
