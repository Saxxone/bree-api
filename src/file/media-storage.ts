import { join, resolve } from 'path';
import * as fs from 'fs';

/** Absolute directory where uploads are stored (disk). */
export function getMediaStorageDir(): string {
  const fromEnv = process.env.MEDIA_STORAGE_PATH?.trim();
  if (fromEnv) {
    return resolve(fromEnv);
  }
  return resolve(join(__dirname, '../../../../', 'media'));
}

export function ensureMediaStorageDir(): void {
  fs.mkdirSync(getMediaStorageDir(), { recursive: true });
}

/**
 * Public URL prefix for stored `File.url` (must be http(s) for browsers).
 * Falls back to API file route when unset or invalid.
 */
export function resolveFileBaseUrl(): string {
  const raw = process.env.FILE_BASE_URL?.trim();
  if (raw && /^https?:\/\//i.test(raw)) {
    return raw.endsWith('/') ? raw : `${raw}/`;
  }
  const api = (process.env.API_BASE_URL ?? 'http://localhost:3000').replace(
    /\/?$/,
    '',
  );
  return `${api}/api/file/media/`;
}

export function isHttpAccessibleUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** True when `FILE_BASE_URL` is set to an external https origin (e.g. Bunny CDN), not the API media fallback. */
export function hasExternalFileCdnConfigured(): boolean {
  const raw = process.env.FILE_BASE_URL?.trim();
  return !!raw && /^https?:\/\//i.test(raw);
}

/** GET /api/file/media/:filename — range-capable, public for UPLOADED files. */
export function mediaFilePublicUrl(filename: string): string {
  const api = (process.env.API_BASE_URL ?? 'http://localhost:3000').replace(
    /\/?$/,
    '',
  );
  return `${api}/api/file/media/${encodeURIComponent(filename)}`;
}
