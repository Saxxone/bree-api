import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from 'src/auth/auth.guard';
import { CoinPurchaseService } from './coin-purchase.service';

@SkipThrottle()
@Controller('coins/stripe')
export class CoinsStripeWebhookController {
  constructor(private readonly purchase: CoinPurchaseService) {}

  @Public()
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    const raw = req.rawBody;
    if (!raw || !Buffer.isBuffer(raw)) {
      throw new BadRequestException('Raw body required for Stripe webhook');
    }
    return this.purchase.handleStripeWebhookEvent(raw, signature);
  }
}
