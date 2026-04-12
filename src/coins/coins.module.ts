import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoinPurchaseService } from './coin-purchase.service';
import { CoinPricingService } from './coin-pricing.service';
import { CoinUnlockService } from './coin-unlock.service';
import { CoinWalletService } from './coin-wallet.service';
import { CoinsController } from './coins.controller';
import { CoinsStripeWebhookController } from './coins-webhook.controller';
import { StreamMonetizationService } from './stream-monetization.service';

@Module({
  imports: [ConfigModule],
  controllers: [CoinsController, CoinsStripeWebhookController],
  providers: [
    CoinWalletService,
    CoinPricingService,
    CoinUnlockService,
    CoinPurchaseService,
    StreamMonetizationService,
  ],
  exports: [
    CoinWalletService,
    CoinPricingService,
    CoinUnlockService,
    CoinPurchaseService,
    StreamMonetizationService,
  ],
})
export class CoinsModule {}
