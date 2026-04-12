import { execFileSync } from 'node:child_process';

/** Prefer a system install (e.g. Homebrew on PATH) over bundled npm binaries. */
function resolveFromPath(cmd: 'ffmpeg' | 'ffprobe'): string | null {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('where', [cmd], {
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      }).trim();
      const first = out.split(/\r?\n/).find((line) => line.trim());
      return first?.trim() || null;
    }
    const out = execFileSync('which', [cmd], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    }).trim();
    return out.split('\n')[0]?.trim() || null;
  } catch {
    return null;
  }
}

export function resolveFfmpegPath(): string {
  const fromEnv = process.env.FFMPEG_PATH?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const onPath = resolveFromPath('ffmpeg');
  if (onPath) {
    return onPath;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const installer = require('@ffmpeg-installer/ffmpeg') as {
      path: string;
    };
    if (installer?.path) {
      return installer.path;
    }
  } catch {
    /* optional dependency resolution */
  }
  return 'ffmpeg';
}

export function resolveFfprobePath(): string {
  const fromEnv = process.env.FFPROBE_PATH?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const onPath = resolveFromPath('ffprobe');
  if (onPath) {
    return onPath;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const installer = require('@ffprobe-installer/ffprobe') as {
      path: string;
    };
    if (installer?.path) {
      return installer.path;
    }
  } catch {
    /* optional dependency resolution */
  }
  return 'ffprobe';
}
