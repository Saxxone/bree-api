import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { studio_ui_base_url } from 'src/utils';
import Stripe from 'stripe';

type StripeClient = InstanceType<typeof Stripe>;

@Injectable()
export class CreatorStripeConnectService {
  private readonly logger = new Logger(CreatorStripeConnectService.name);
  private stripe: StripeClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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

  async getConnectStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeConnectAccountId: true,
        stripeConnectChargesEnabled: true,
        stripeConnectPayoutsEnabled: true,
      },
    });
    return {
      hasAccount: Boolean(user?.stripeConnectAccountId),
      stripeConnectAccountId: user?.stripeConnectAccountId ?? null,
      chargesEnabled: user?.stripeConnectChargesEnabled ?? false,
      payoutsEnabled: user?.stripeConnectPayoutsEnabled ?? false,
    };
  }

  async createOnboardingLink(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        stripeConnectAccountId: true,
      },
    });

    const country =
      this.config.get<string>('STRIPE_CONNECT_DEFAULT_COUNTRY') ?? 'US';
    const base = studio_ui_base_url.replace(/\/$/, '');

    let accountId = user.stripeConnectAccountId;
    if (!accountId) {
      const account = await this.getStripe().accounts.create({
        type: 'express',
        country,
        email: user.email,
        capabilities: {
          transfers: { requested: true },
        },
        metadata: { afovidUserId: user.id },
      });
      accountId = account.id;
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeConnectAccountId: accountId },
      });
    }

    const link = await this.getStripe().accountLinks.create({
      account: accountId,
      refresh_url: `${base}/withdraw?stripe_refresh=1`,
      return_url: `${base}/withdraw?stripe_return=1`,
      type: 'account_onboarding',
    });

    if (!link.url) {
      throw new BadRequestException('Stripe did not return an onboarding URL');
    }

    return { url: link.url, stripeConnectAccountId: accountId };
  }

  /**
   * Sync Connect account flags from Stripe webhooks (account.updated).
   */
  async syncAccountFromStripe(account: {
    id: string;
    charges_enabled?: boolean | null;
    payouts_enabled?: boolean | null;
  }): Promise<void> {
    const id = account.id;
    const updated = await this.prisma.user.updateMany({
      where: { stripeConnectAccountId: id },
      data: {
        stripeConnectChargesEnabled: account.charges_enabled ?? false,
        stripeConnectPayoutsEnabled: account.payouts_enabled ?? false,
      },
    });
    if (updated.count === 0) {
      this.logger.warn(`account.updated for unknown Connect account ${id}`);
    }
  }

  logTransferEvent(
    type: string,
    transfer: { id: string; amount: number; destination?: string | null },
  ): void {
    this.logger.log(
      `Stripe ${type}: transfer=${transfer.id} amount=${transfer.amount} dest=${transfer.destination}`,
    );
  }
}
