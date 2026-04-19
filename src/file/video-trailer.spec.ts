import {
  buildFfmpegTrailerArgs,
  trailerClipSeconds,
} from './video-trailer';

describe('trailerClipSeconds', () => {
  it('caps at maxSeconds', () => {
    expect(trailerClipSeconds(120, 10)).toBe(10);
  });

  it('uses full duration when shorter than cap', () => {
    expect(trailerClipSeconds(4, 10)).toBe(4);
  });

  it('returns at least 1 second for tiny positive duration', () => {
    expect(trailerClipSeconds(0.2, 10)).toBe(1);
  });

  it('returns 0 for invalid duration', () => {
    expect(trailerClipSeconds(0, 10)).toBe(0);
    expect(trailerClipSeconds(-1, 10)).toBe(0);
    expect(trailerClipSeconds(NaN, 10)).toBe(0);
  });
});

describe('buildFfmpegTrailerArgs', () => {
  it('includes libx264 and duration when audio present', () => {
    const args = buildFfmpegTrailerArgs('/in.mp4', '/out.mp4', 10, true);
    expect(args).toContain('-i');
    expect(args).toContain('/in.mp4');
    expect(args).toContain('-t');
    expect(args).toContain('10');
    expect(args).toContain('libx264');
    expect(args).toContain('aac');
    expect(args[args.length - 1]).toBe('/out.mp4');
  });

  it('uses -an when no audio', () => {
    const args = buildFfmpegTrailerArgs('/in.mov', '/out.mp4', 5, false);
    expect(args).toContain('-an');
    expect(args).not.toContain('aac');
  });
});
