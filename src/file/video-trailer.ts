import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolveFfmpegPath, resolveFfprobePath } from './media-binary-path';

const execFileAsync = promisify(execFile);

const DEFAULT_MAX_SECONDS = 10;

/** Exported for unit tests. */
export function trailerClipSeconds(
  durationSeconds: number,
  maxSeconds: number = DEFAULT_MAX_SECONDS,
): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 0;
  }
  const cap = Number.isFinite(maxSeconds) && maxSeconds > 0 ? maxSeconds : DEFAULT_MAX_SECONDS;
  return Math.max(1, Math.min(cap, Math.round(durationSeconds)));
}

export async function probeHasAudioStream(absolutePath: string): Promise<boolean> {
  const ffprobe = resolveFfprobePath();
  try {
    const { stdout } = await execFileAsync(
      ffprobe,
      [
        '-v',
        'error',
        '-select_streams',
        'a:0',
        '-show_entries',
        'stream=codec_type',
        '-of',
        'csv=p=0',
        absolutePath,
      ],
      { maxBuffer: 1024 * 1024 },
    );
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/** Builds ffmpeg argv for the trailer transcode (first `clipSeconds` of input). */
export function buildFfmpegTrailerArgs(
  inputAbsolutePath: string,
  outputAbsolutePath: string,
  clipSeconds: number,
  hasAudio: boolean,
): string[] {
  const args: string[] = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    inputAbsolutePath,
    '-t',
    String(clipSeconds),
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
  ];
  if (hasAudio) {
    args.push('-c:a', 'aac', '-b:a', '128k');
  } else {
    args.push('-an');
  }
  args.push(outputAbsolutePath);
  return args;
}

/**
 * Writes an MP4 trailer (H.264, AAC or silent) from the first `clipSeconds` of the source.
 */
export async function generateVideoTrailer(
  inputAbsolutePath: string,
  outputAbsolutePath: string,
  opts?: { maxSeconds?: number; durationSeconds?: number },
): Promise<void> {
  const maxSeconds = opts?.maxSeconds ?? DEFAULT_MAX_SECONDS;
  const duration = opts?.durationSeconds;
  const clipSeconds =
    duration !== undefined && Number.isFinite(duration)
      ? trailerClipSeconds(duration, maxSeconds)
      : maxSeconds;
  if (clipSeconds <= 0) {
    throw new Error('Invalid clip duration for trailer');
  }

  const hasAudio = await probeHasAudioStream(inputAbsolutePath);
  const ffmpeg = resolveFfmpegPath();
  const args = buildFfmpegTrailerArgs(
    inputAbsolutePath,
    outputAbsolutePath,
    clipSeconds,
    hasAudio,
  );
  await execFileAsync(ffmpeg, args, { maxBuffer: 20 * 1024 * 1024 });
}
