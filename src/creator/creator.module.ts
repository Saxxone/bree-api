import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoinsModule } from 'src/coins/coins.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CreatorController } from './creator.controller';
import { CreatorPayoutService } from './creator-payout.service';
import { CreatorStripeConnectService } from './creator-stripe-connect.service';
import { CreatorWalletService } from './creator-wallet.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    forwardRef(() => CoinsModule),
  ],
  controllers: [CreatorController],
  providers: [
    CreatorWalletService,
    CreatorStripeConnectService,
    CreatorPayoutService,
  ],
  exports: [CreatorStripeConnectService],
})
export class CreatorModule {}
