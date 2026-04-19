import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CoinTxnType } from '@prisma/client';
import { CoinWalletService } from 'src/coins/coin-wallet.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SuperAdminGuard } from './super-admin.guard';

class AdminPatchCoinPackageDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  coinsMinor?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  stripePriceId?: string | null;

  @IsOptional()
  @IsString()
  appleProductId?: string | null;

  @IsOptional()
  @IsString()
  googleProductId?: string | null;
}

class AdminCoinAdjustmentDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @Type(() => Number)
  @IsInt()
  amountMinor: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  idempotencyKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

@Controller('admin/coins')
@UseGuards(SuperAdminGuard)
export class AdminCoinsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: CoinWalletService,
  ) {}

  @Get('packages')
  async listPackages() {
    return this.prisma.coinPackage.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  @Patch('packages/:id')
  async patchPackage(
    @Param('id') id: string,
    @Body() body: AdminPatchCoinPackageDto,
  ) {
    return this.prisma.coinPackage.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.coinsMinor !== undefined && { coinsMinor: body.coinsMinor }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
        ...(body.active !== undefined && { active: body.active }),
        ...(body.stripePriceId !== undefined && {
          stripePriceId: body.stripePriceId,
        }),
        ...(body.appleProductId !== undefined && {
          appleProductId: body.appleProductId,
        }),
        ...(body.googleProductId !== undefined && {
          googleProductId: body.googleProductId,
        }),
      },
    });
  }

  @Get('ledger')
  async ledger(
    @Query('type') type?: CoinTxnType,
    @Query('userId') userId?: string,
    @Query('skip') skipRaw?: string,
    @Query('take') takeRaw?: string,
  ) {
    const skip = Math.min(parseInt(skipRaw ?? '0', 10) || 0, 100_000);
    const take = Math.min(Math.max(parseInt(takeRaw ?? '50', 10) || 50, 1), 200);

    const walletFilter = userId ? { userId } : undefined;

    const where = {
      ...(type && { type }),
      ...(walletFilter && { wallet: walletFilter }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.coinLedgerEntry.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          wallet: {
            select: { userId: true },
          },
        },
      }),
      this.prisma.coinLedgerEntry.count({ where }),
    ]);

    return { items, total, skip, take };
  }

  @Post('adjustments')
  async adjustment(@Body() body: AdminCoinAdjustmentDto) {
    return this.wallet.runWalletTransaction(async (tx) => {
      const meta = body.reason
        ? { reason: body.reason, source: 'admin' }
        : { source: 'admin' };
      return this.wallet.applyDeltaTx(
        tx,
        body.userId,
        body.amountMinor,
        CoinTxnType.ADJUSTMENT,
        `admin-adjust:${body.userId}:${body.idempotencyKey}`,
        meta,
      );
    });
  }
}
