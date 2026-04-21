/** R2-backed object store for video pipeline (see env.example MEDIA_OBJECT_STORE). */
export function isR2ObjectStoreEnabled(): boolean {
  return process.env.MEDIA_OBJECT_STORE?.trim().toLowerCase() === 'r2';
}
