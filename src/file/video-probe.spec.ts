import { StreamQuality } from '@prisma/client';
import { dimensionsToStreamQuality } from './video-probe';

describe('dimensionsToStreamQuality', () => {
  it('maps 1280x720 to P720', () => {
    expect(dimensionsToStreamQuality(1280, 720)).toBe(StreamQuality.P720);
  });

  it('maps 1920x1080 to P1080', () => {
    expect(dimensionsToStreamQuality(1920, 1080)).toBe(StreamQuality.P1080);
  });

  it('maps 3840x2160 to P4K', () => {
    expect(dimensionsToStreamQuality(3840, 2160)).toBe(StreamQuality.P4K);
  });

  it('uses longer edge for portrait video', () => {
    expect(dimensionsToStreamQuality(1080, 1920)).toBe(StreamQuality.P1080);
  });
});
