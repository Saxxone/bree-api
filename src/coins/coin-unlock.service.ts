import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CoinTxnType, StreamQuality } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CoinPricingService } from './coin-pricing.service';
import { CoinWalletService } from './coin-wallet.service';

@Injectable()
export class CoinUnlockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: CoinPricingService,
    private readonly wallet: CoinWalletService,
  ) {}

  async unlockPost(viewerUserId: string, postId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (!post.published) {
      throw new BadRequestException('Post is not published');
    }
    if (!post.monetizationEnabled) {
      throw new BadRequestException('Post is not monetized');
    }
    if (post.authorId === viewerUserId) {
      throw new BadRequestException(
        'Author does not need to unlock own content',
      );
    }

    const price = post.pricedCostMinor;
    if (price === null || price === undefined || price <= 0) {
      throw new BadRequestException(
        'This post has no fixed coin price yet; the author may need to re-save it after upload.',
      );
    }

    const sourceQuality = post.sourceStreamQuality ?? StreamQuality.P1080;

    const existing = await this.prisma.postUnlock.findUnique({
      where: {
        userId_postId: { userId: viewerUserId, postId },
      },
    });

    if (existing) {
      return {
        unlocked: true,
        chargedMinor: 0,
        pricedCostMinor: price,
        sourceStreamQuality: sourceQuality,
        alreadyUnlocked: true,
      };
    }

    const chargeMinor = price;
    const correlation = randomUUID();
    const { creatorMinor, platformMinor } =
      this.pricing.splitCreatorPlatform(chargeMinor);

    await this.wallet.runWalletTransaction(async (tx) => {
      await this.wallet.applyDeltaTx(
        tx,
        viewerUserId,
        -chargeMinor,
        CoinTxnType.SPEND_UNLOCK,
        `unlock:spend:${postId}:${viewerUserId}:${correlation}`,
        { postId, chargeMinor, sourceStreamQuality: sourceQuality },
      );

      await this.wallet.applyDeltaTx(
        tx,
        post.authorId,
        creatorMinor,
        CoinTxnType.CREATOR_EARN,
        `unlock:earn:${postId}:${post.authorId}:${correlation}`,
        {
          postId,
          viewerUserId,
          creatorMinor,
          sourceStreamQuality: sourceQuality,
        },
      );

      await tx.postUnlock.create({
        data: {
          userId: viewerUserId,
          postId,
          maxStreamQuality: sourceQuality,
          totalPaidMinor: chargeMinor,
          platformFeeAccumulatedMinor: platformMinor,
        },
      });
    });

    return {
      unlocked: true,
      chargedMinor: chargeMinor,
      pricedCostMinor: price,
      sourceStreamQuality: sourceQuality,
      alreadyUnlocked: false,
      creatorCreditedMinor: creatorMinor,
      platformFeeMinor: platformMinor,
    };
  }

  async quote(postId: string, viewerUserId?: string) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (!post.monetizationEnabled) {
      throw new BadRequestException('Post is not monetized');
    }

    const price = post.pricedCostMinor;
    const sourceQuality = post.sourceStreamQuality;

    if (
      price === null ||
      price === undefined ||
      price <= 0 ||
      !sourceQuality ||
      !post.videoCategory ||
      !post.videoDurationSeconds
    ) {
      throw new BadRequestException(
        'This post does not have a computed coin price yet.',
      );
    }

    const breakdown = this.pricing.computeCostMinorForPost(
      {
        videoDurationSeconds: post.videoDurationSeconds,
        videoCategory: post.videoCategory,
        productionTier: post.productionTier,
        baseRateMinorPerMinute: post.baseRateMinorPerMinute,
      },
      sourceQuality,
    );

    const existing = viewerUserId
      ? await this.prisma.postUnlock.findUnique({
          where: { userId_postId: { userId: viewerUserId, postId } },
        })
      : null;

    const chargeMinor = existing ? 0 : price;
    const { creatorMinor, platformMinor } =
      this.pricing.splitCreatorPlatform(chargeMinor);

    return {
      postId,
      /** Fixed price stored on the post (what viewers pay). */
      pricedCostMinor: price,
      sourceStreamQuality: sourceQuality,
      chargeMinor,
      alreadyUnlocked: !!existing,
      creatorShareIfChargedMinor: creatorMinor,
      platformShareIfChargedMinor: platformMinor,
      breakdown: {
        ...breakdown,
        /** May differ from `pricedCostMinor` if rates changed after publish. */
        recomputedCostMinor: breakdown.costMinor,
      },
    };
  }

  async hasUnlockedPost(
    viewerUserId: string,
    postId: string,
  ): Promise<boolean> {
    const row = await this.prisma.postUnlock.findUnique({
      where: { userId_postId: { userId: viewerUserId, postId } },
    });
    return !!row;
  }
}
