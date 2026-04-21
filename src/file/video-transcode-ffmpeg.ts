import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolveFfmpegPath } from './media-binary-path';

const execFileAsync = promisify(execFile);

const ffmpeg = () => resolveFfmpegPath();

/** HLS VOD package: `index.m3u8` + `segment*.ts` in `outDir` (relative names in manifest). */
export async function transcodeToHls(
  inputAbsolutePath: string,
  outDir: string,
): Promise<void> {
  await execFileAsync(
    ffmpeg(),
    [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      inputAbsolutePath,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-hls_time',
      '6',
      '-hls_playlist_type',
      'vod',
      '-hls_segment_filename',
      'segment%03d.ts',
      '-f',
      'hls',
      'index.m3u8',
    ],
    { maxBuffer: 20 * 1024 * 1024, cwd: outDir },
  );
}

/** Progressive MP4 for API range streaming (copy when possible). */
export async function transcodeToPlaybackMp4(
  inputAbsolutePath: string,
  outputAbsolutePath: string,
): Promise<void> {
  try {
    await execFileAsync(
      ffmpeg(),
      [
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        inputAbsolutePath,
        '-c',
        'copy',
        '-movflags',
        '+faststart',
        outputAbsolutePath,
      ],
      { maxBuffer: 20 * 1024 * 1024 },
    );
  } catch {
    await execFileAsync(
      ffmpeg(),
      [
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        inputAbsolutePath,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        outputAbsolutePath,
      ],
      { maxBuffer: 20 * 1024 * 1024 },
    );
  }
}
