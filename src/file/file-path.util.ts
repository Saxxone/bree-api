import { resolve, isAbsolute } from 'path';
import { getMediaStorageDir } from './media-storage';

/** Resolve stored `File.path` (absolute or relative to media dir) to an absolute path. */
export function resolveDiskPathForFile(
  storedPath: string | null | undefined,
): string {
  const trimmed = storedPath?.trim() ?? '';
  if (!trimmed) {
    return '';
  }
  return isAbsolute(trimmed)
    ? resolve(trimmed)
    : resolve(getMediaStorageDir(), trimmed);
}
