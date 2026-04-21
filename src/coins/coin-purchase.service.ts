import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CoinPurchaseProvider,
  CoinPurchaseStatus,
  CoinTxnType,
} from '@prisma/client';
import { SignJWT, decodeJwt, importPKCS8 } from 'jose';
import { google } from 'googleapis';
import Stripe from 'stripe';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatorStripeConnectService } from 'src/creator/creator-stripe-connect.service';
import { CoinWalletService } from './coin-wallet.service';

type StripeClient = InstanceType<typeof Stripe>;
type StripeWebhookEvent = ReturnType<
  StripeClient['webhooks']['constructEvent']
>;

@Injectable()
export class CoinPurchaseService {
  private readonly logger = new Logger(CoinPurchaseService.name);
  private stripe: StripeClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly wallet: CoinWalletService,
    @Inject(forwardRef(() => CreatorStripeConnectService))
    private readonly creatorStripeConnect: CreatorStripeConnectService,
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

  async listPackages() {
    return this.prisma.coinPackage.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        coinsMinor: true,
        stripePriceId: true,
        appleProductId: true,
        googleProductId: true,
        sortOrder: true,
      },
    });
  }

  async createStripeCheckoutSession(
    userId: string,
    packageId: string,
    client: 'web' | 'native' = 'web',
  ) {
    const pkg = await this.prisma.coinPackage.findFirst({
      where: { id: packageId, active: true },
    });
    if (!pkg?.stripePriceId) {
      throw new BadRequestException(
        'Package not available for Stripe checkout',
      );
    }
    if (pkg.stripePriceId.startsWith('prod_')) {
      throw new BadRequestException(
        'Coin package is configured with a Stripe Product ID; use a Price ID (price_...) from the product’s Pricing section in the Stripe Dashboard.',
      );
    }

    const scheme =
      this.config.get<string>('MOBILE_APP_URL_SCHEME')?.replace(/:$/, '') ??
      'myapp';
    const nativeSuccess =
      this.config.get<string>('STRIPE_CHECKOUT_NATIVE_SUCCESS_URL') ??
      `${scheme}://coins/success?session_id={CHECKOUT_SESSION_ID}`;
    const nativeCancel =
      this.config.get<string>('STRIPE_CHECKOUT_NATIVE_CANCEL_URL') ??
      `${scheme}://coins/cancel`;

    const successUrl =
      client === 'native'
        ? nativeSuccess
        : (this.config.get<string>('STRIPE_CHECKOUT_SUCCESS_URL') ??
          `${this.config.get<string>('UI_BASE_URL') ?? 'http://localhost:4000'}/coins/success?session_id={CHECKOUT_SESSION_ID}`);
    const cancelUrl =
      client === 'native'
        ? nativeCancel
        : (this.config.get<string>('STRIPE_CHECKOUT_CANCEL_URL') ??
          `${this.config.get<string>('UI_BASE_URL') ?? 'http://localhost:4000'}/coins/cancel`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const session = await this.getStripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: pkg.stripePriceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(user?.email ? { customer_email: user.email } : {}),
      metadata: {
        userId,
        packageId: pkg.id,
        coinsMinor: String(pkg.coinsMinor),
      },
    });

    return { url: session.url, sessionId: session.id };
  }

  async handleStripeWebhookEvent(
    rawBody: Buffer,
    signature: string | undefined,
  ) {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) {
      throw new ServiceUnavailableException('Stripe webhook not configured');
    }
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    let event: StripeWebhookEvent;
    try {
      event = this.getStripe().webhooks.constructEvent(
        rawBody,
        signature,
        secret,
      );
    } catch (err) {
      this.logger.warn(`Stripe webhook signature failed: ${err}`);
      throw new BadRequestException('Invalid Stripe signature');
    }

    const kind = event.type as string;

    switch (kind) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        return this.handleCheckoutSessionCompleted(event);
      case 'account.updated': {
        const account = event.data.object as {
          id: string;
          charges_enabled?: boolean | null;
          payouts_enabled?: boolean | null;
        };
        await this.creatorStripeConnect.syncAccountFromStripe(account);
        return { received: true, connect: true };
      }
      default:
        if (kind.startsWith('transfer.')) {
          const transfer = event.data.object as {
            id: string;
            amount: number;
            destination?: string | { id: string } | null;
          };
          const destination =
            typeof transfer.destination === 'string'
              ? transfer.destination
              : transfer.destination && typeof transfer.destination === 'object'
                ? transfer.destination.id
                : undefined;
          this.creatorStripeConnect.logTransferEvent(kind, {
            id: transfer.id,
            amount: transfer.amount,
            destination,
          });
          return { received: true, transfer: kind };
        }
        return { received: true, ignored: true };
    }
  }

  private async handleCheckoutSessionCompleted(event: StripeWebhookEvent) {
    const session = event.data.object as {
      id?: string;
      metadata?: { userId?: string; packageId?: string };
    };
    const userId = session.metadata?.userId;
    const packageId = session.metadata?.packageId;
    if (!userId || !packageId) {
      this.logger.warn('Stripe session missing userId/packageId metadata');
      return { received: true, skipped: true };
    }

    const pkg = await this.prisma.coinPackage.findFirst({
      where: { id: packageId, active: true },
    });
    if (!pkg) {
      this.logger.error(`Unknown package ${packageId} in Stripe webhook`);
      return { received: true, skipped: true };
    }

    const externalId = `stripe_evt:${event.id}`;
    const existing = await this.prisma.coinPurchase.findUnique({
      where: {
        provider_externalId: {
          provider: CoinPurchaseProvider.STRIPE,
          externalId,
        },
      },
    });
    if (existing?.status === CoinPurchaseStatus.COMPLETED) {
      return { received: true, duplicate: true };
    }

    await this.wallet.runWalletTransaction(async (tx) => {
      const dup = await tx.coinPurchase.findUnique({
        where: {
          provider_externalId: {
            provider: CoinPurchaseProvider.STRIPE,
            externalId,
          },
        },
      });
      if (dup?.status === CoinPurchaseStatus.COMPLETED) {
        return;
      }

      await tx.coinPurchase.create({
        data: {
          userId,
          packageId: pkg.id,
          provider: CoinPurchaseProvider.STRIPE,
          externalId,
          status: CoinPurchaseStatus.COMPLETED,
          coinsMinor: pkg.coinsMinor,
        },
      });

      await this.wallet.applyDeltaTx(
        tx,
        userId,
        pkg.coinsMinor,
        CoinTxnType.PURCHASE_STRIPE,
        `purchase:stripe:${externalId}`,
        { packageId: pkg.id, sessionId: session.id },
      );
    });

    return { received: true, credited: true };
  }

  private async getAppleServerJwt(): Promise<string> {
    const issuerId = this.config.get<string>('APPLE_ISSUER_ID');
    const keyId = this.config.get<string>('APPLE_KEY_ID');
    const rawKey = this.config.get<string>('APPLE_PRIVATE_KEY');
    const bundleId = this.config.get<string>('APPLE_BUNDLE_ID');
    if (!issuerId || !keyId || !rawKey || !bundleId) {
      throw new ServiceUnavailableException('Apple IAP is not configured');
    }
    const pem = rawKey.includes('BEGIN')
      ? rawKey
      : Buffer.from(rawKey, 'base64').toString('utf8');
    const key = await importPKCS8(pem, 'ES256');
    return new SignJWT({ bid: bundleId })
      .setProtectedHeader({ alg: 'ES256', kid: keyId, typ: 'JWT' })
      .setIssuer(issuerId)
      .setAudience('appstoreconnect-v1')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(key);
  }

  async creditFromAppleTransaction(userId: string, transactionId: string) {
    const bundleId = this.config.get<string>('APPLE_BUNDLE_ID');
    if (!bundleId) {
      throw new ServiceUnavailableException('APPLE_BUNDLE_ID is not set');
    }

    const sandbox =
      this.config.get<string>('APPLE_USE_SANDBOX')?.toLowerCase() === 'true';
    const base = sandbox
      ? 'https://api.storekit-sandbox.itunes.apple.com'
      : 'https://api.storekit.itunes.apple.com';

    const token = await this.getAppleServerJwt();
    const res = await fetch(
      `${base}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(
        `Apple transaction lookup failed: ${res.status} ${text}`,
      );
      throw new BadRequestException('Invalid or unknown Apple transaction');
    }

    const body = (await res.json()) as { signedTransactionInfo?: string };
    if (!body.signedTransactionInfo) {
      throw new BadRequestException('Malformed Apple response');
    }

    const payload = decodeJwt(body.signedTransactionInfo) as {
      productId?: string;
      transactionId?: string;
      bundleId?: string;
    };

    if (payload.bundleId && payload.bundleId !== bundleId) {
      throw new BadRequestException('Bundle ID mismatch');
    }

    const productId = payload.productId;
    if (!productId) {
      throw new BadRequestException('Missing productId in transaction');
    }

    const pkg = await this.prisma.coinPackage.findFirst({
      where: { active: true, appleProductId: productId },
    });
    if (!pkg) {
      throw new NotFoundException('No coin package for this Apple product');
    }

    const appleTxnId = payload.transactionId ?? transactionId;
    const externalId = `apple:${appleTxnId}`;

    await this.wallet.runWalletTransaction(async (tx) => {
      const existing = await tx.coinPurchase.findUnique({
        where: {
          provider_externalId: {
            provider: CoinPurchaseProvider.APPLE,
            externalId,
          },
        },
      });
      if (existing?.status === CoinPurchaseStatus.COMPLETED) {
        return;
      }

      await tx.coinPurchase.create({
        data: {
          userId,
          packageId: pkg.id,
          provider: CoinPurchaseProvider.APPLE,
          externalId,
          status: CoinPurchaseStatus.COMPLETED,
          coinsMinor: pkg.coinsMinor,
        },
      });

      await this.wallet.applyDeltaTx(
        tx,
        userId,
        pkg.coinsMinor,
        CoinTxnType.PURCHASE_APPLE,
        `purchase:apple:${externalId}`,
        { packageId: pkg.id, appleTransactionId: appleTxnId },
      );
    });

    return { credited: true, coinsMinor: pkg.coinsMinor, packageId: pkg.id };
  }

  async creditFromGooglePurchase(
    userId: string,
    productId: string,
    purchaseToken: string,
  ) {
    const packageName = this.config.get<string>('GOOGLE_PLAY_PACKAGE_NAME');
    const saJson = this.config.get<string>('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
    if (!packageName || !saJson) {
      throw new ServiceUnavailableException('Google Play is not configured');
    }

    let credentials: object;
    try {
      credentials = JSON.parse(saJson) as object;
    } catch {
      throw new ServiceUnavailableException(
        'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON must be valid JSON',
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    const androidPublisher = google.androidpublisher({
      version: 'v3',
      auth,
    });

    const getRes = await androidPublisher.purchases.products.get({
      packageName,
      productId,
      token: purchaseToken,
    });

    const purchaseState = getRes.data.purchaseState;
    if (purchaseState !== 0) {
      throw new BadRequestException('Purchase is not in purchased state');
    }

    const pkg = await this.prisma.coinPackage.findFirst({
      where: { active: true, googleProductId: productId },
    });
    if (!pkg) {
      throw new NotFoundException('No coin package for this Google SKU');
    }

    const externalId = `google:${purchaseToken}`;

    await this.wallet.runWalletTransaction(async (tx) => {
      const existing = await tx.coinPurchase.findUnique({
        where: {
          provider_externalId: {
            provider: CoinPurchaseProvider.GOOGLE,
            externalId,
          },
        },
      });
      if (existing?.status === CoinPurchaseStatus.COMPLETED) {
        return;
      }

      await tx.coinPurchase.create({
        data: {
          userId,
          packageId: pkg.id,
          provider: CoinPurchaseProvider.GOOGLE,
          externalId,
          status: CoinPurchaseStatus.COMPLETED,
          coinsMinor: pkg.coinsMinor,
        },
      });

      await this.wallet.applyDeltaTx(
        tx,
        userId,
        pkg.coinsMinor,
        CoinTxnType.PURCHASE_GOOGLE,
        `purchase:google:${externalId}`,
        { packageId: pkg.id, productId },
      );
    });

    try {
      await androidPublisher.purchases.products.consume({
        packageName,
        productId,
        token: purchaseToken,
      });
    } catch (e) {
      this.logger.warn(`Google consume failed (may already be consumed): ${e}`);
    }

    return { credited: true, coinsMinor: pkg.coinsMinor, packageId: pkg.id };
  }
}
