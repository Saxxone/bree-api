function parseNonNegativeInt(
  s: string | undefined,
  defaultValue: number,
): number {
  if (s === undefined || s === '') return defaultValue;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return defaultValue;
  return Math.floor(n);
}

export type FeedRankingConfig = {
  replyBoostMinScore: number;
  likeWeight: number;
  commentWeight: number;
  bookmarkWeight: number;
};

/**
 * Env-tunable feed ranking for reply “boost” into the same tier as root short/long posts.
 * Tier ordering itself lives in `PostService.getFeedPosts` raw SQL — keep the interaction
 * formula in sync with {@link replyBoostInteractionScore}.
 */
export function getFeedRankingConfig(): FeedRankingConfig {
  return {
    replyBoostMinScore: parseNonNegativeInt(
      process.env.FEED_REPLY_BOOST_MIN_SCORE,
      75,
    ),
    likeWeight: parseNonNegativeInt(
      process.env.FEED_REPLY_BOOST_LIKE_WEIGHT,
      1,
    ),
    commentWeight: parseNonNegativeInt(
      process.env.FEED_REPLY_BOOST_COMMENT_WEIGHT,
      2,
    ),
    bookmarkWeight: parseNonNegativeInt(
      process.env.FEED_REPLY_BOOST_BOOKMARK_WEIGHT,
      1,
    ),
  };
}

/** Same linear combination as the `getFeedPosts` SQL `ORDER BY` boost branch. */
export function replyBoostInteractionScore(
  likeCount: number,
  commentCount: number,
  bookmarkCount: number,
  cfg: Pick<
    FeedRankingConfig,
    'likeWeight' | 'commentWeight' | 'bookmarkWeight'
  >,
): number {
  return (
    likeCount * cfg.likeWeight +
    commentCount * cfg.commentWeight +
    bookmarkCount * cfg.bookmarkWeight
  );
}
