import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Query,
  Request,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CoinTxnType } from '@prisma/client';
import { JwtPayload } from 'src/auth/auth.guard';
import { CreatorPayoutDto } from './dto/creator-payout.dto';
import { CreatorPayoutService } from './creator-payout.service';
import { CreatorStripeConnectService } from './creator-stripe-connect.service';
import { CreatorWalletService } from './creator-wallet.service';

function parseLedgerType(raw?: string): CoinTxnType | undefined {
  if (raw === undefined || raw === '') {
    return undefined;
  }
  const values = Object.values(CoinTxnType) as string[];
  if (!values.includes(raw)) {
    throw new BadRequestException('Invalid ledger type filter');
  }
  return raw as CoinTxnType;
}

@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
  }),
)
@Controller('creator')
export class CreatorController {
  constructor(
    private readonly creatorWallet: CreatorWalletService,
    private readonly connect: CreatorStripeConnectService,
    private readonly payout: CreatorPayoutService,
  ) {}

  @Get('wallet/summary')
  async walletSummary(@Request() req: { user: JwtPayload }) {
    return this.creatorWallet.getSummary(req.user.userId);
  }

  @Get('wallet/ledger')
  async walletLedger(
    @Request() req: { user: JwtPayload },
    @Query('skip') skipRaw?: string,
    @Query('take') takeRaw?: string,
    @Query('type') typeRaw?: string,
  ) {
    const skip = Math.min(parseInt(skipRaw ?? '0', 10) || 0, 100_000);
    const take = Math.min(Math.max(parseInt(takeRaw ?? '50', 10) || 50, 1), 200);
    const type = parseLedgerType(typeRaw);
    return this.creatorWallet.getLedger(req.user.userId, { skip, take, type });
  }

  @Get('stripe/connect/status')
  async connectStatus(@Request() req: { user: JwtPayload }) {
    return this.connect.getConnectStatus(req.user.userId);
  }

  @Post('stripe/connect/onboarding-link')
  async onboardingLink(@Request() req: { user: JwtPayload }) {
    return this.connect.createOnboardingLink(req.user.userId);
  }

  @Post('payouts')
  async payouts(
    @Request() req: { user: JwtPayload },
    @Body() body: CreatorPayoutDto,
  ) {
    return this.payout.requestPayout(
      req.user.userId,
      body.coinsMinor,
      body.idempotencyKey,
    );
  }
}
