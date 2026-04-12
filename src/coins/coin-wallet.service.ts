import { ConflictException, Injectable } from '@nestjs/common';
import { CoinTxnType, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CoinWalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalanceMinor(userId: string): Promise<number> {
    const w = await this.prisma.coinWallet.findUnique({
      where: { userId },
      select: { balanceMinor: true },
    });
    return w?.balanceMinor ?? 0;
  }

  /**
   * Apply a signed delta to the user's wallet inside an existing transaction.
   * Idempotent: duplicate idempotencyKey returns without changing balance.
   */
  async applyDeltaTx(
    tx: Prisma.TransactionClient,
    userId: string,
    amountMinor: number,
    type: CoinTxnType,
    idempotencyKey: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<{ balanceAfterMinor: number; duplicate: boolean }> {
    const existing = await tx.coinLedgerEntry.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return {
        balanceAfterMinor: existing.balanceAfterMinor,
        duplicate: true,
      };
    }

    const wallet = await tx.coinWallet.upsert({
      where: { userId },
      create: { userId, balanceMinor: 0 },
      update: {},
    });

    const next = wallet.balanceMinor + amountMinor;
    if (next < 0) {
      throw new ConflictException('Insufficient coin balance');
    }

    const updated = await tx.coinWallet.update({
      where: { id: wallet.id },
      data: { balanceMinor: next },
    });

    await tx.coinLedgerEntry.create({
      data: {
        walletId: wallet.id,
        type,
        amountMinor,
        balanceAfterMinor: updated.balanceMinor,
        idempotencyKey,
        metadata: metadata ?? undefined,
      },
    });

    return { balanceAfterMinor: updated.balanceMinor, duplicate: false };
  }

  async runWalletTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2034'
      ) {
        throw new ConflictException(
          'Wallet busy; please retry the transaction',
        );
      }
      throw e;
    }
  }

  async ensureWallet(userId: string) {
    return this.prisma.coinWallet.upsert({
      where: { userId },
      create: { userId, balanceMinor: 0 },
      update: {},
    });
  }
}
