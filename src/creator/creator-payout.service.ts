import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CoinTxnType, Prisma } from '@prisma/client';
import { CoinWalletService } from 'src/coins/coin-wallet.service';
import { PrismaService } from 'src/prisma/prisma.service';
import Stripe from 'stripe';

type StripeClient = InstanceType<typeof Stripe>;

function payoutMetadata(
  usdCents: number,
  stripeTransferId?: string,
  completed?: boolean,
): Record<string, unknown> {
  return {
    usdCents,
    ...(stripeTransferId ? { stripeTransferId } : {}),
    ...(completed !== undefined ? { completed } : {}),
  };
}

@Injectable()
export class CreatorPayoutService {
  private readonly logger = new Logger(CreatorPayoutService.name);
  private stripe: StripeClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly wallet: CoinWalletService,
  ) {}

  private getStripe(): StripeClient {
    if (this.stripe) {
      return this.stripe;
    }
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!key) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }
    this.stripe = new Stripe(key);
    return this.stripe;
  }

  private coinsMinorToUsdCents(coinsMinor: number): number {
    const num = parseInt(
      this.config.get<string>('COIN_PAYOUT_USD_CENTS_NUMERATOR') ?? '100',
      10,
    );
    const den = parseInt(
      this.config.get<string>('COIN_PAYOUT_USD_CENTS_DENOMINATOR') ?? '10000',
      10,
    );
    if (
      !Number.isFinite(num) ||
      !Number.isFinite(den) ||
      num <= 0 ||
      den <= 0
    ) {
      throw new ServiceUnavailableException(
        'Invalid coin payout conversion config',
      );
    }
    return Math.floor((coinsMinor * num) / den);
  }

  async requestPayout(
    userId: string,
    coinsMinor: number,
    clientIdempotencyKey: string,
  ) {
    const minUsd = parseInt(
      this.config.get<string>('CREATOR_PAYOUT_MIN_USD_CENTS') ?? '50',
      10,
    );
    const minCoinsRaw = this.config.get<string>(
      'CREATOR_PAYOUT_MIN_COINS_MINOR',
    );
    const minCoins = minCoinsRaw ? parseInt(minCoinsRaw, 10) : 1;

    if (!Number.isFinite(minUsd) || minUsd < 1) {
      throw new ServiceUnavailableException(
        'Invalid CREATOR_PAYOUT_MIN_USD_CENTS',
      );
    }
    if (!Number.isFinite(minCoins) || minCoins < 1) {
      throw new ServiceUnavailableException(
        'Invalid CREATOR_PAYOUT_MIN_COINS_MINOR',
      );
    }

    if (coinsMinor < minCoins) {
      throw new BadRequestException(
        `Minimum cashout is ${minCoins} coin minor units`,
      );
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        stripeConnectAccountId: true,
        stripeConnectPayoutsEnabled: true,
      },
    });

    if (!user.stripeConnectAccountId) {
      throw new ForbiddenException('Complete Stripe Connect onboarding first');
    }
    if (!user.stripeConnectPayoutsEnabled) {
      throw new ForbiddenException(
        'Stripe payouts are not enabled for this account yet',
      );
    }

    const usdCents = this.coinsMinorToUsdCents(coinsMinor);
    if (usdCents < minUsd) {
      throw new BadRequestException(
        `Cash value must be at least ${minUsd} USD cents for this payout`,
      );
    }

    const debitKey = `payout:debit:${userId}:${clientIdempotencyKey}`;
    const rollbackKey = `payout:rollback:${userId}:${clientIdempotencyKey}`;
    const stripeIdemKey = `payout-stripe-transfer:${userId}:${clientIdempotencyKey}`;

    const existingDebit = await this.prisma.coinLedgerEntry.findUnique({
      where: { idempotencyKey: debitKey },
      include: { wallet: { select: { userId: true } } },
    });
    if (existingDebit && existingDebit.wallet.userId !== userId) {
      throw new ConflictException('Idempotency key conflict');
    }

    if (existingDebit?.metadata && typeof existingDebit.metadata === 'object') {
      const m = existingDebit.metadata as Record<string, unknown>;
      const tid = m.stripeTransferId;
      if (typeof tid === 'string' && tid.length > 0) {
        return {
          ok: true,
          duplicateRequest: true,
          usdCents: typeof m.usdCents === 'number' ? m.usdCents : usdCents,
          coinsMinor,
          stripeTransferId: tid,
        };
      }
    }

    const existingRollback = await this.prisma.coinLedgerEntry.findUnique({
      where: { idempotencyKey: rollbackKey },
    });
    if (existingRollback) {
      throw new ConflictException(
        'This payout attempt was reversed; use a new idempotency key to cash out again',
      );
    }

    let debitedFresh = false;
    if (!existingDebit) {
      await this.wallet.runWalletTransaction(async (tx) => {
        await this.wallet.applyDeltaTx(
          tx,
          userId,
          -coinsMinor,
          CoinTxnType.PAYOUT,
          debitKey,
          {
            ...payoutMetadata(usdCents),
            pendingStripeTransfer: true,
          },
        );
      });
      debitedFresh = true;
    }

    try {
      const transfer = await this.getStripe().transfers.create(
        {
          amount: usdCents,
          currency: 'usd',
          destination: user.stripeConnectAccountId,
          metadata: {
            afovidUserId: userId,
            coinsMinor: String(coinsMinor),
          },
        },
        { idempotencyKey: stripeIdemKey },
      );

      await this.prisma.coinLedgerEntry.updateMany({
        where: { idempotencyKey: debitKey },
        data: {
          metadata: payoutMetadata(
            usdCents,
            transfer.id,
            true,
          ) as Prisma.InputJsonValue,
        },
      });

      return {
        ok: true,
        duplicateRequest: false,
        usdCents,
        coinsMinor,
        stripeTransferId: transfer.id,
      };
    } catch (err) {
      this.logger.error(`Stripe transfer failed: ${err}`);
      const shouldRollback = debitedFresh || Boolean(existingDebit);
      if (shouldRollback) {
        try {
          await this.wallet.runWalletTransaction(async (tx) => {
            await this.wallet.applyDeltaTx(
              tx,
              userId,
              coinsMinor,
              CoinTxnType.ADJUSTMENT,
              rollbackKey,
              {
                reason: 'payout_stripe_transfer_failed',
                originalDebitIdempotencyKey: debitKey,
              },
            );
          });
        } catch (rollbackErr) {
          this.logger.error(`Payout rollback failed: ${rollbackErr}`);
        }
      }
      throw new ServiceUnavailableException(
        'Transfer to your connected account could not be completed; your coin balance was restored if it had been debited',
      );
    }
  }
}
