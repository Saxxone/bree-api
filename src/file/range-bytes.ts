/**
 * Parse the first range in `Range` (RFC 7233). Returns null so caller can fall back
 * to 200 full body when the header is absent or unusable.
 */
export function parseSingleByteRange(
  range: string | undefined,
  fileSize: number,
): { start: number; end: number } | null {
  if (!range || fileSize <= 0) return null;
  const r = range.trim();
  if (!r.toLowerCase().startsWith('bytes=')) return null;
  const first = r.slice(6).split(',')[0].trim();

  const suffix = /^-(\d+)$/.exec(first);
  if (suffix) {
    const len = parseInt(suffix[1], 10);
    if (!Number.isFinite(len) || len <= 0) return null;
    const start = Math.max(0, fileSize - len);
    const end = fileSize - 1;
    if (start > end) return null;
    return { start, end };
  }

  const std = /^(\d+)-(\d*)$/.exec(first);
  if (!std) return null;
  const start = parseInt(std[1], 10);
  let end = std[2] !== '' ? parseInt(std[2], 10) : fileSize - 1;
  if (
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    start < 0 ||
    start >= fileSize ||
    start > end
  ) {
    return null;
  }
  end = Math.min(end, fileSize - 1);
  return { start, end };
}
