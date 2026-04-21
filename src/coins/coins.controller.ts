import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Public } from 'src/auth/auth.guard';
import { CoinPurchaseService } from './coin-purchase.service';
import { CoinUnlockService } from './coin-unlock.service';
import { CoinWalletService } from './coin-wallet.service';
import { StripeCheckoutDto } from './dto/stripe-checkout.dto';
import { VerifyAppleDto } from './dto/verify-apple.dto';
import { VerifyGoogleDto } from './dto/verify-google.dto';

@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
  }),
)
@Controller('coins')
export class CoinsController {
  constructor(
    private readonly purchase: CoinPurchaseService,
    private readonly unlock: CoinUnlockService,
    private readonly wallet: CoinWalletService,
  ) {}

  @Public()
  @Get('packages')
  async listPackages() {
    return this.purchase.listPackages();
  }

  @Get('balance')
  async balance(@Request() req: { user: { userId: string } }) {
    const minor = await this.wallet.getBalanceMinor(req.user.userId);
    return { balanceMinor: minor };
  }

  @Public()
  @Get('quote/:postId')
  async quote(
    @Param('postId') postId: string,
    @Request() req: { user?: { userId: string } },
  ) {
    return this.unlock.quote(postId, req.user?.userId);
  }

  @Post('unlock/:postId')
  async unlockPost(
    @Request() req: { user: { userId: string } },
    @Param('postId') postId: string,
  ) {
    return this.unlock.unlockPost(req.user.userId, postId);
  }

  @Post('checkout/stripe')
  async stripeCheckout(
    @Request() req: { user: { userId: string } },
    @Body() body: StripeCheckoutDto,
  ) {
    return this.purchase.createStripeCheckoutSession(
      req.user.userId,
      body.packageId,
      body.client ?? 'web',
    );
  }

  @Post('verify/apple')
  async verifyApple(
    @Request() req: { user: { userId: string } },
    @Body() body: VerifyAppleDto,
  ) {
    return this.purchase.creditFromAppleTransaction(
      req.user.userId,
      body.transactionId,
    );
  }

  @Post('verify/google')
  async verifyGoogle(
    @Request() req: { user: { userId: string } },
    @Body() body: VerifyGoogleDto,
  ) {
    return this.purchase.creditFromGooglePurchase(
      req.user.userId,
      body.productId,
      body.purchaseToken,
    );
  }
}
