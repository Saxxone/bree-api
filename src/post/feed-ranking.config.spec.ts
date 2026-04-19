import {
  getFeedRankingConfig,
  replyBoostInteractionScore,
} from './feed-ranking.config';

describe('feed-ranking.config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.FEED_REPLY_BOOST_MIN_SCORE;
    delete process.env.FEED_REPLY_BOOST_LIKE_WEIGHT;
    delete process.env.FEED_REPLY_BOOST_COMMENT_WEIGHT;
    delete process.env.FEED_REPLY_BOOST_BOOKMARK_WEIGHT;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('replyBoostInteractionScore matches default weights (must stay in sync with getFeedPosts SQL)', () => {
    const cfg = getFeedRankingConfig();
    expect(
      replyBoostInteractionScore(10, 30, 5, {
        likeWeight: cfg.likeWeight,
        commentWeight: cfg.commentWeight,
        bookmarkWeight: cfg.bookmarkWeight,
      }),
    ).toBe(10 * 1 + 30 * 2 + 5 * 1);
    expect(cfg.replyBoostMinScore).toBe(75);
  });

  it('parses FEED_REPLY_BOOST_* env overrides', () => {
    process.env.FEED_REPLY_BOOST_MIN_SCORE = '100';
    process.env.FEED_REPLY_BOOST_LIKE_WEIGHT = '2';
    process.env.FEED_REPLY_BOOST_COMMENT_WEIGHT = '1';
    process.env.FEED_REPLY_BOOST_BOOKMARK_WEIGHT = '3';
    const cfg = getFeedRankingConfig();
    expect(cfg.replyBoostMinScore).toBe(100);
    expect(cfg.likeWeight).toBe(2);
    expect(cfg.commentWeight).toBe(1);
    expect(cfg.bookmarkWeight).toBe(3);
    expect(replyBoostInteractionScore(1, 1, 1, cfg)).toBe(2 + 1 + 3);
  });

  it('ignores invalid env and falls back to defaults', () => {
    process.env.FEED_REPLY_BOOST_MIN_SCORE = 'not-a-number';
    process.env.FEED_REPLY_BOOST_LIKE_WEIGHT = '-1';
    const cfg = getFeedRankingConfig();
    expect(cfg.replyBoostMinScore).toBe(75);
    expect(cfg.likeWeight).toBe(1);
  });
});
