import { ConfigService } from '@nestjs/config';
import { ProductionTier, StreamQuality, VideoCategory } from '@prisma/client';
import { CoinPricingService } from './coin-pricing.service';

describe('CoinPricingService', () => {
  const config = {
    get: (key: string) => (key === 'COIN_BASE_RATE_MINOR_PER_MIN' ? '20' : ''),
  } as unknown as ConfigService;

  let service: CoinPricingService;

  beforeEach(() => {
    service = new CoinPricingService(config);
  });

  it('computes 62.4 coins (624 minor) for 10min educational 4K pro at 2 coins/min', () => {
    const post = {
      videoDurationSeconds: 600,
      videoCategory: VideoCategory.EDUCATIONAL_DIY,
      productionTier: ProductionTier.PRO,
      baseRateMinorPerMinute: null as number | null,
    };

    const b = service.computeCostMinorForPost(post, StreamQuality.P4K);
    expect(b.costMinor).toBe(624);
  });

  it('splits 70/30 with floor toward creator', () => {
    expect(service.splitCreatorPlatform(624)).toEqual({
      creatorMinor: 436,
      platformMinor: 188,
    });
  });
});
