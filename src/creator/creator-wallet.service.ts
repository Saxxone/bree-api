import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CoinTxnType, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CoinWalletService } from 'src/coins/coin-wallet.service';

export type CreatorLedgerRow = {
  id: string;
  type: CoinTxnType;
  amountMinor: number;
  balanceAfterMinor: number;
  createdAt: Date;
  metadata: Prisma.JsonValue | null;
};

@Injectable()
export class CreatorWalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly wallet: CoinWalletService,
  ) {}

  async getSummary(userId: string) {
    const balanceMinor = await this.wallet.getBalanceMinor(userId);
    const wallet = await this.prisma.coinWallet.findUnique({
      where: { userId },
      select: { id: true },
    });
    const payoutConfig = {
      usdCentsNumerator: parseInt(
        this.config.get<string>('COIN_PAYOUT_USD_CENTS_NUMERATOR') ?? '100',
        10,
      ),
      usdCentsDenominator: parseInt(
        this.config.get<string>('COIN_PAYOUT_USD_CENTS_DENOMINATOR') ?? '10000',
        10,
      ),
      minUsdCents: parseInt(
        this.config.get<string>('CREATOR_PAYOUT_MIN_USD_CENTS') ?? '50',
        10,
      ),
      minCoinsMinor: parseInt(
        this.config.get<string>('CREATOR_PAYOUT_MIN_COINS_MINOR') ?? '1',
        10,
      ),
    };

    if (!wallet) {
      return {
        balanceMinor,
        lifetimeEarnedMinor: 0,
        lifetimePayoutMinor: 0,
        dailyCreatorEarnMinor: [] as { day: string; amountMinor: number }[],
        payoutConfig,
      };
    }

    const [earnAgg, payoutAgg] = await Promise.all([
      this.prisma.coinLedgerEntry.aggregate({
        where: { walletId: wallet.id, type: CoinTxnType.CREATOR_EARN },
        _sum: { amountMinor: true },
      }),
      this.prisma.coinLedgerEntry.aggregate({
        where: { walletId: wallet.id, type: CoinTxnType.PAYOUT },
        _sum: { amountMinor: true },
      }),
    ]);

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);
    since.setUTCHours(0, 0, 0, 0);

    const series = await this.prisma.$queryRaw<
      { day: Date; amount_minor: bigint }[]
    >(Prisma.sql`
      SELECT date_trunc('day', cle."createdAt") AS day,
             SUM(cle."amountMinor")::bigint AS amount_minor
      FROM "CoinLedgerEntry" cle
      WHERE cle."walletId" = ${wallet.id}
        AND cle.type = 'CREATOR_EARN'
        AND cle."createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    return {
      balanceMinor,
      lifetimeEarnedMinor: earnAgg._sum.amountMinor ?? 0,
      lifetimePayoutMinor: Math.abs(payoutAgg._sum.amountMinor ?? 0),
      dailyCreatorEarnMinor: series.map((r) => ({
        day: r.day.toISOString().slice(0, 10),
        amountMinor: Number(r.amount_minor),
      })),
      payoutConfig,
    };
  }

  async getLedger(
    userId: string,
    opts: { skip: number; take: number; type?: CoinTxnType },
  ): Promise<{ items: CreatorLedgerRow[]; total: number; skip: number; take: number }> {
    const wallet = await this.prisma.coinWallet.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!wallet) {
      return { items: [], total: 0, skip: opts.skip, take: opts.take };
    }

    const where = {
      walletId: wallet.id,
      ...(opts.type ? { type: opts.type } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.coinLedgerEntry.findMany({
        where,
        skip: opts.skip,
        take: opts.take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          amountMinor: true,
          balanceAfterMinor: true,
          createdAt: true,
          metadata: true,
        },
      }),
      this.prisma.coinLedgerEntry.count({ where }),
    ]);

    return { items, total, skip: opts.skip, take: opts.take };
  }
}
