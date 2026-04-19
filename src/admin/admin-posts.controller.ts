import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PostType, Prisma } from '@prisma/client';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { JwtPayload } from 'src/auth/auth.guard';
import { PostService } from 'src/post/post.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SuperAdminGuard } from './super-admin.guard';

function postRecordHasVideoMedia(post: {
  mediaTypes: string[];
  longPost?: {
    content?: Array<{ mediaTypes?: string[] }>;
  } | null;
}): boolean {
  if (post.mediaTypes?.includes('video')) return true;
  const blocks = post.longPost?.content ?? [];
  return blocks.some((b) => (b.mediaTypes ?? []).includes('video'));
}

class AdminPatchPostDto {
  @IsOptional()
  @IsBoolean()
  published?: boolean;

  /** Coin price in minor units; send `null` to clear. Skips automatic repricing. */
  @IsOptional()
  @IsInt()
  @Min(0)
  pricedCostMinor?: number | null;
}

@Controller('admin/posts')
@UseGuards(SuperAdminGuard)
export class AdminPostsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postService: PostService,
  ) {}

  @Get()
  async list(
    @Query('published') publishedRaw?: string,
    @Query('monetizationEnabled') monetizationRaw?: string,
    @Query('videosOnly') videosOnlyRaw?: string,
    @Query('type') type?: PostType,
    @Query('skip') skipRaw?: string,
    @Query('take') takeRaw?: string,
  ) {
    const skip = Math.min(parseInt(skipRaw ?? '0', 10) || 0, 100_000);
    const take = Math.min(
      Math.max(parseInt(takeRaw ?? '30', 10) || 30, 1),
      100,
    );

    const where: Prisma.PostWhereInput = { deletedAt: null };
    if (publishedRaw === 'true') where.published = true;
    if (publishedRaw === 'false') where.published = false;
    if (monetizationRaw === 'true') where.monetizationEnabled = true;
    if (monetizationRaw === 'false') where.monetizationEnabled = false;
    if (type) where.type = type;
    if (videosOnlyRaw === 'true') {
      const videoWhere: Prisma.PostWhereInput = {
        OR: [
          { mediaTypes: { has: 'video' } },
          {
            longPost: {
              content: {
                some: { mediaTypes: { has: 'video' } },
              },
            },
          },
        ],
      };
      const existingAnd = where.AND;
      where.AND = [
        ...(Array.isArray(existingAnd)
          ? existingAnd
          : existingAnd
            ? [existingAnd]
            : []),
        videoWhere,
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          text: true,
          published: true,
          monetizationEnabled: true,
          videoCategory: true,
          videoDurationSeconds: true,
          sourceStreamQuality: true,
          pricedCostMinor: true,
          productionTier: true,
          type: true,
          authorId: true,
          createdAt: true,
          mediaTypes: true,
          longPost: {
            select: {
              content: { select: { mediaTypes: true } },
            },
          },
          author: {
            select: { id: true, username: true, email: true },
          },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    const listItems = items.map(({ longPost, mediaTypes, ...rest }) => ({
      ...rest,
      mediaTypes,
      hasVideo: postRecordHasVideoMedia({ mediaTypes, longPost }),
    }));

    return { items: listItems, total, skip, take };
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @Request() req: { user: JwtPayload }) {
    return this.postService.viewSinglePost(id, req.user.sub);
  }

  @Patch(':id')
  async patchPublished(
    @Param('id') id: string,
    @Body() body: AdminPatchPostDto,
    @Request() req: { user: JwtPayload },
  ) {
    const hasPublished = body.published !== undefined;
    const hasPrice = body.pricedCostMinor !== undefined;

    if (!hasPublished && !hasPrice) {
      return this.prisma.post.findUniqueOrThrow({
        where: { id },
        include: {
          author: { select: { id: true, username: true, email: true } },
        },
      });
    }

    if (hasPublished) {
      await this.postService.updatePost({
        where: { id },
        data: { published: body.published },
        email: req.user.sub,
      });
    }

    if (hasPrice) {
      const mediaRow = await this.prisma.post.findUniqueOrThrow({
        where: { id },
        select: {
          mediaTypes: true,
          longPost: {
            select: {
              content: { select: { mediaTypes: true } },
            },
          },
        },
      });
      if (!postRecordHasVideoMedia(mediaRow)) {
        throw new BadRequestException(
          'Price override is only allowed for posts that include video.',
        );
      }
      await this.prisma.post.update({
        where: { id },
        data: { pricedCostMinor: body.pricedCostMinor },
      });
    }

    return this.prisma.post.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        text: true,
        published: true,
        monetizationEnabled: true,
        videoCategory: true,
        videoDurationSeconds: true,
        sourceStreamQuality: true,
        pricedCostMinor: true,
        productionTier: true,
        type: true,
        authorId: true,
        createdAt: true,
        author: {
          select: { id: true, username: true, email: true },
        },
      },
    });
  }

  @Post(':id/reprice')
  async reprice(@Param('id') id: string) {
    const mediaRow = await this.prisma.post.findUniqueOrThrow({
      where: { id },
      select: {
        mediaTypes: true,
        longPost: {
          select: {
            content: { select: { mediaTypes: true } },
          },
        },
      },
    });
    if (!postRecordHasVideoMedia(mediaRow)) {
      throw new BadRequestException(
        'Reprice is only available for posts that include video.',
      );
    }
    await this.postService.syncMonetizationPricingForPost(id);
    return this.prisma.post.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        monetizationEnabled: true,
        videoCategory: true,
        videoDurationSeconds: true,
        sourceStreamQuality: true,
        pricedCostMinor: true,
      },
    });
  }
}
