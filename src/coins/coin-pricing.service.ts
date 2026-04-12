import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Post,
  ProductionTier,
  StreamQuality,
  VideoCategory,
} from '@prisma/client';

/** Integer multipliers: 10 = 1.0x, 12 = 1.2x, etc. Denominator 10 per axis. */
const QUALITY_NUM: Record<StreamQuality, number> = {
  P720: 10,
  P1080: 12,
  P4K: 16,
};

const CATEGORY_NUM: Record<VideoCategory, number> = {
  ENTERTAINMENT: 10,
  EDUCATIONAL_DIY: 15,
  LIVE_EVENT: 20,
};

const PRODUCTION_NUM: Record<ProductionTier, number> = {
  STANDARD: 10,
  PRO: 13,
};

const QUALITY_RANK: Record<StreamQuality, number> = {
  P720: 1,
  P1080: 2,
  P4K: 3,
};

export type PricingBreakdown = {
  baseRateMinorPerMinute: number;
  durationSeconds: number;
  streamQuality: StreamQuality;
  videoCategory: VideoCategory;
  productionTier: ProductionTier;
  qualityNumerator: number;
  categoryNumerator: number;
  productionNumerator: number;
  costMinor: number;
};

@Injectable()
export class CoinPricingService {
  constructor(private readonly config: ConfigService) {}

  getDefaultBaseRateMinorPerMinute(): number {
    const raw = this.config.get<string>('COIN_BASE_RATE_MINOR_PER_MIN');
    const n = parseInt(raw ?? '20', 10);
    return Number.isFinite(n) && n > 0 ? n : 20;
  }

  streamQualityRank(q: StreamQuality): number {
    return QUALITY_RANK[q];
  }

  /**
   * costMinor = round( baseRateMinorPerMinute * durationSeconds * Q * C * P / (60 * 10^3) )
   * with Q,C,P as numerators over 10 (1.0x -> 10).
   */
  computeCostMinorForPost(
    post: Pick<
      Post,
      | 'videoDurationSeconds'
      | 'videoCategory'
      | 'productionTier'
      | 'baseRateMinorPerMinute'
    >,
    streamQuality: StreamQuality,
  ): PricingBreakdown {
    if (!post.videoDurationSeconds || post.videoDurationSeconds <= 0) {
      throw new BadRequestException(
        'Monetized posts require videoDurationSeconds > 0',
      );
    }
    if (!post.videoCategory) {
      throw new BadRequestException('Monetized posts require videoCategory');
    }

    const baseRateMinorPerMinute =
      post.baseRateMinorPerMinute ?? this.getDefaultBaseRateMinorPerMinute();

    const q = QUALITY_NUM[streamQuality];
    const c = CATEGORY_NUM[post.videoCategory];
    const p = PRODUCTION_NUM[post.productionTier];

    const numerator =
      baseRateMinorPerMinute * post.videoDurationSeconds * q * c * p;
    const denominator = 60 * 10 * 10 * 10;
    const costMinor = Math.round(numerator / denominator);

    if (costMinor <= 0) {
      throw new BadRequestException('Computed coin cost must be positive');
    }

    return {
      baseRateMinorPerMinute,
      durationSeconds: post.videoDurationSeconds,
      streamQuality,
      videoCategory: post.videoCategory,
      productionTier: post.productionTier,
      qualityNumerator: q,
      categoryNumerator: c,
      productionNumerator: p,
      costMinor,
    };
  }

  splitCreatorPlatform(totalMinor: number): {
    creatorMinor: number;
    platformMinor: number;
  } {
    const creatorMinor = Math.floor((totalMinor * 70) / 100);
    const platformMinor = totalMinor - creatorMinor;
    return { creatorMinor, platformMinor };
  }
}
