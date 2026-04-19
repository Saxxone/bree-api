import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  Post,
  PostType,
  Prisma,
  Status as FileStatus,
  User,
} from '@prisma/client';
import { CoinPricingService } from 'src/coins/coin-pricing.service';
import { FileService } from 'src/file/file.service';
import {
  isHttpAccessibleUrl,
  mediaFilePublicUrl,
} from 'src/file/media-storage';
import { NotificationTypes } from 'src/notification/dto/create-notification.dto';
import { NotificationService } from 'src/notification/notification.service';
import { StreamMonetizationService } from 'src/coins/stream-monetization.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';

/** Post as returned from queries that may include `longPost.content` (playback URLs). */
type PostWithLongPostMedia = Post & {
  longPost?: {
    id: string;
    content?: Array<{ media: string[]; mediaTypes: string[] }>;
  } | null;
};

/** Per-asset metadata aligned with `media` / `mediaPlayback` (null if file row missing). */
export type PostMediaMetadataEntry = {
  fileId: string;
  sizeBytes: number;
  mimeType: string;
  originalFilename: string;
  /** If true, client should send auth (e.g. Bearer or `?token=`) when loading `mediaPlayback`. Stream mode is always true. */
  requiresAuth: boolean;
  /** video / audio only: direct URL vs range streaming */
  playbackMode?: 'direct' | 'stream';
  /**
   * Video/audio only: post-level coin paywall toggle (mirrors `Post.monetizationEnabled`).
   * When false, `pricedCostMinor` / `paywalled` are omitted for that asset.
   */
  monetizationEnabled?: boolean;
  /**
   * Video/audio only: fixed unlock price for the post in minor coin units when `monetizationEnabled`.
   * Same value on each streamed asset of a monetized post.
   */
  pricedCostMinor?: number | null;
  /** Coin paywall: no playback URL returned until unlocked */
  paywalled?: boolean;
  /** Stored trailer URL when generated; may be non-http when FILE_BASE_URL is unset. */
  trailerUrl?: string | null;
  /**
   * Short preview clip (`/api/file/media/:trailerFilename`) when present.
   * Still returned when the full asset is paywalled so clients can autoplay a teaser.
   */
  trailerPlayback?: string | null;
};

type FileRowForPlayback = {
  id: string;
  type: string;
  mimetype: string;
  size: number;
  originalname: string;
  filename: string;
  url: string;
  status: FileStatus;
  trailerFilename: string | null;
  trailerUrl: string | null;
};

function parseVideoDirectPlaybackMaxBytes(): number {
  const raw = process.env.VIDEO_DIRECT_PLAYBACK_MAX_BYTES;
  if (raw === undefined || raw === '') {
    return 25 * 1024 * 1024;
  }
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    return 25 * 1024 * 1024;
  }
  return n;
}

function parseMediaDirectUrlRequiresAuth(): boolean {
  const raw = process.env.MEDIA_DIRECT_URL_REQUIRES_AUTH;
  if (raw === undefined || raw === '') {
    return false;
  }
  const lower = raw.toLowerCase();
  return lower === '1' || lower === 'true' || lower === 'yes';
}

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

  /** Used after writes to avoid concurrent pg `client.query()` on one connection (Prisma adapter-pg + pg ≥8.20). */
  private readonly defaultPostInclude: Prisma.PostInclude = {
    likedBy: true,
    bookmarkedBy: true,
    author: {
      select: {
        id: true,
        name: true,
        img: true,
        username: true,
      },
    },
    longPost: {
      select: {
        id: true,
        content: true,
      },
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
    private readonly notificationService: NotificationService,
    private readonly streamMonetization: StreamMonetizationService,
    private readonly coinPricing: CoinPricingService,
  ) {}

  private loadPostAfterWrite(postId: string) {
    return this.prisma.post.findUniqueOrThrow({
      where: { id: postId },
      include: this.defaultPostInclude,
    });
  }

  private static readonly STREAMED_MEDIA_TYPES = new Set(['video', 'audio']);
  private static readonly NO_STREAM_FALLBACK_FROM_POST_TYPES = new Set([
    'image',
  ]);
  private readonly videoDirectPlaybackMaxBytes =
    parseVideoDirectPlaybackMaxBytes();
  private readonly mediaDirectUrlRequiresAuth =
    parseMediaDirectUrlRequiresAuth();

  private streamUrlForFileId(fileId: string): string {
    const base = (process.env.API_BASE_URL ?? '').replace(/\/$/, '');
    const path = `/api/file/stream/${fileId}`;
    return base ? `${base}${path}` : path;
  }

  private collectMediaUrlsFromPosts(posts: PostWithLongPostMedia[]): string[] {
    const urls = new Set<string>();
    for (const post of posts) {
      post.media?.forEach((u) => {
        if (u) urls.add(u);
      });
      const blocks = post.longPost?.content ?? [];
      for (const b of blocks) {
        b.media?.forEach((u) => {
          if (u) urls.add(u);
        });
      }
    }
    return [...urls];
  }

  private buildMediaPlaybackAndMetadata(
    media: string[],
    mediaTypes: string[],
    fileByUrl: Map<string, FileRowForPlayback>,
    lockedFileIds: Set<string>,
    /** Post-level monetization: affects auth on playback URLs and per-video metadata backfill. */
    postMonetization: { enabled: boolean; pricedCostMinor: number | null },
  ): {
    mediaPlayback: string[];
    mediaMetadata: (PostMediaMetadataEntry | null)[];
  } {
    if (!media.length) {
      return { mediaPlayback: [], mediaMetadata: [] };
    }
    const mediaPlayback: string[] = [];
    const mediaMetadata: (PostMediaMetadataEntry | null)[] = [];

    for (let i = 0; i < media.length; i++) {
      const url = media[i];
      const t = mediaTypes[i];
      const file = fileByUrl.get(url);

      if (!file) {
        mediaPlayback.push(url);
        mediaMetadata.push(null);
        continue;
      }

      const storedUrlIsHttp = isHttpAccessibleUrl(url);
      const directPlaybackUrl = storedUrlIsHttp
        ? url
        : mediaFilePublicUrl(file.filename);

      const directRequiresAuth =
        file.status !== FileStatus.UPLOADED
          ? true
          : storedUrlIsHttp && this.mediaDirectUrlRequiresAuth;

      const streamedFromFile = PostService.STREAMED_MEDIA_TYPES.has(file.type);
      const streamedFromPost =
        Boolean(t) &&
        PostService.STREAMED_MEDIA_TYPES.has(t as string) &&
        !PostService.NO_STREAM_FALLBACK_FROM_POST_TYPES.has(file.type);
      const isStreamedMedia = streamedFromFile || streamedFromPost;

      const trailerExtras = (): Pick<
        PostMediaMetadataEntry,
        'trailerUrl' | 'trailerPlayback'
      > => {
        if (file.type !== 'video') {
          return {};
        }
        if (file.trailerFilename) {
          return {
            trailerUrl: file.trailerUrl ?? null,
            /** Teaser clip URL; included even when the full asset is paywalled. */
            trailerPlayback: mediaFilePublicUrl(file.trailerFilename),
          };
        }
        /** Legacy rows: HTTP `trailerUrl` without separate `trailerFilename`. */
        if (file.trailerUrl && isHttpAccessibleUrl(file.trailerUrl)) {
          return {
            trailerUrl: file.trailerUrl,
            trailerPlayback: file.trailerUrl,
          };
        }
        return {
          trailerUrl: file.trailerUrl ?? null,
        };
      };

      const streamMonetizationFields = (): Partial<
        Pick<
          PostMediaMetadataEntry,
          'monetizationEnabled' | 'pricedCostMinor' | 'paywalled'
        >
      > => {
        if (!isStreamedMedia) {
          return {};
        }
        if (!postMonetization.enabled) {
          return { monetizationEnabled: false };
        }
        const locked = lockedFileIds.has(file.id);
        return {
          monetizationEnabled: true,
          pricedCostMinor: postMonetization.pricedCostMinor,
          paywalled: locked,
        };
      };

      if (isStreamedMedia && lockedFileIds.has(file.id)) {
        mediaPlayback.push('');
        mediaMetadata.push({
          fileId: file.id,
          sizeBytes: file.size,
          mimeType: file.mimetype,
          originalFilename: file.originalname,
          requiresAuth: true,
          ...streamMonetizationFields(),
          ...trailerExtras(),
        });
        continue;
      }

      if (!isStreamedMedia) {
        mediaPlayback.push(directPlaybackUrl);
        mediaMetadata.push({
          fileId: file.id,
          sizeBytes: file.size,
          mimeType: file.mimetype,
          originalFilename: file.originalname,
          requiresAuth: directRequiresAuth,
          ...trailerExtras(),
        });
        continue;
      }

      const useStreaming = file.size > this.videoDirectPlaybackMaxBytes;
      let requiresAuth = useStreaming ? true : directRequiresAuth;
      if (postMonetization.enabled && isStreamedMedia) {
        requiresAuth = true;
      }
      mediaPlayback.push(
        useStreaming ? this.streamUrlForFileId(file.id) : directPlaybackUrl,
      );
      mediaMetadata.push({
        fileId: file.id,
        sizeBytes: file.size,
        mimeType: file.mimetype,
        originalFilename: file.originalname,
        requiresAuth,
        playbackMode: useStreaming ? 'stream' : 'direct',
        ...streamMonetizationFields(),
        ...trailerExtras(),
      });
    }

    return { mediaPlayback, mediaMetadata };
  }

  private enrichPostPlayback(
    post: PostWithLongPostMedia,
    fileByUrl: Map<string, FileRowForPlayback>,
    lockedFileIds: Set<string>,
  ): PostWithLongPostMedia & {
    mediaPlayback: string[];
    mediaMetadata: (PostMediaMetadataEntry | null)[];
  } {
    const postMonetization = {
      enabled: post.monetizationEnabled === true,
      pricedCostMinor: post.pricedCostMinor ?? null,
    };
    const { mediaPlayback, mediaMetadata } = post.media?.length
      ? this.buildMediaPlaybackAndMetadata(
          post.media,
          post.mediaTypes ?? [],
          fileByUrl,
          lockedFileIds,
          postMonetization,
        )
      : { mediaPlayback: [], mediaMetadata: [] };

    const longPost = post.longPost
      ? {
          ...post.longPost,
          content: (post.longPost.content ?? []).map((block) => {
            const built = block.media?.length
              ? this.buildMediaPlaybackAndMetadata(
                  block.media,
                  block.mediaTypes ?? [],
                  fileByUrl,
                  lockedFileIds,
                  postMonetization,
                )
              : {
                  mediaPlayback: [] as string[],
                  mediaMetadata: [] as (PostMediaMetadataEntry | null)[],
                };
            return {
              ...block,
              mediaPlayback: built.mediaPlayback,
              mediaMetadata: built.mediaMetadata,
            };
          }),
        }
      : post.longPost;

    return {
      ...post,
      mediaPlayback,
      mediaMetadata,
      longPost,
    } as PostWithLongPostMedia & {
      mediaPlayback: string[];
      mediaMetadata: (PostMediaMetadataEntry | null)[];
    };
  }

  private collectVideoUrlsFromPostRecord(post: {
    media: string[];
    longPost?: { content?: Array<{ media: string[] }> } | null;
  }): string[] {
    const urls = [...(post.media ?? [])];
    for (const b of post.longPost?.content ?? []) {
      urls.push(...(b.media ?? []));
    }
    return urls.filter(Boolean);
  }

  /**
   * Recompute fixed coin price from uploaded video metadata (ffprobe) and post category/tier.
   */
  private async syncMonetizationPricingToDb(postId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        longPost: {
          select: {
            content: { select: { media: true } },
          },
        },
      },
    });
    if (!post) {
      return;
    }

    if (!post.monetizationEnabled) {
      await this.prisma.post.update({
        where: { id: postId },
        data: {
          pricedCostMinor: null,
          sourceStreamQuality: null,
          videoDurationSeconds: null,
        },
      });
      return;
    }

    if (!post.videoCategory) {
      await this.prisma.post.update({
        where: { id: postId },
        data: {
          pricedCostMinor: null,
          sourceStreamQuality: null,
          videoDurationSeconds: null,
        },
      });
      return;
    }

    const urls = this.collectVideoUrlsFromPostRecord(post);
    if (urls.length === 0) {
      this.logger.warn(
        `syncMonetizationPricingToDb(${postId}): no media URLs on post (short media + longPost blocks empty)`,
      );
      await this.prisma.post.update({
        where: { id: postId },
        data: {
          pricedCostMinor: null,
          sourceStreamQuality: null,
          videoDurationSeconds: null,
        },
      });
      return;
    }

    const agg = await this.fileService.aggregateVideoMonetizationInputs(
      urls,
      post.authorId,
    );
    if (!agg) {
      this.logger.warn(
        `syncMonetizationPricingToDb(${postId}): could not aggregate video metadata for ${urls.length} URL(s); check File.url vs post media, ffprobe, and videoCategory`,
      );
      await this.prisma.post.update({
        where: { id: postId },
        data: {
          pricedCostMinor: null,
          sourceStreamQuality: null,
          videoDurationSeconds: null,
        },
      });
      return;
    }

    const breakdown = this.coinPricing.computeCostMinorForPost(
      {
        videoDurationSeconds: agg.totalDurationSeconds,
        videoCategory: post.videoCategory,
        productionTier: post.productionTier,
        baseRateMinorPerMinute: post.baseRateMinorPerMinute,
      },
      agg.sourceStreamQuality,
    );

    await this.prisma.post.update({
      where: { id: postId },
      data: {
        videoDurationSeconds: agg.totalDurationSeconds,
        sourceStreamQuality: agg.sourceStreamQuality,
        pricedCostMinor: breakdown.costMinor,
      },
    });
  }

  /** Recompute monetization pricing from video metadata (admin / support). */
  async syncMonetizationPricingForPost(postId: string): Promise<void> {
    await this.syncMonetizationPricingToDb(postId);
  }

  private async viewerUserIdFromEmail(
    email?: string,
  ): Promise<string | undefined> {
    if (!email) {
      return undefined;
    }
    const u = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return u?.id;
  }

  private async withMediaPlayback(
    post: PostWithLongPostMedia,
    viewerUserId?: string,
  ): Promise<
    PostWithLongPostMedia & {
      mediaPlayback: string[];
      mediaMetadata: (PostMediaMetadataEntry | null)[];
    }
  > {
    const fileByUrl = await this.fileService.findFilesByUrls(
      this.collectMediaUrlsFromPosts([post]),
    );
    const locked =
      await this.streamMonetization.getLockedVideoFileIdsForPostView(
        {
          id: post.id,
          authorId: post.authorId,
          published: post.published,
          monetizationEnabled: post.monetizationEnabled,
          media: post.media ?? [],
          longPost: post.longPost,
        },
        viewerUserId,
      );
    return this.enrichPostPlayback(post, fileByUrl, locked);
  }

  private async withMediaPlaybackMany(
    posts: PostWithLongPostMedia[],
    viewerUserId?: string,
  ): Promise<
    Array<
      PostWithLongPostMedia & {
        mediaPlayback: string[];
        mediaMetadata: (PostMediaMetadataEntry | null)[];
      }
    >
  > {
    if (posts.length === 0) {
      return [];
    }
    const fileByUrl = await this.fileService.findFilesByUrls(
      this.collectMediaUrlsFromPosts(posts),
    );
    return Promise.all(
      posts.map(async (p) => {
        const locked =
          await this.streamMonetization.getLockedVideoFileIdsForPostView(
            {
              id: p.id,
              authorId: p.authorId,
              published: p.published,
              monetizationEnabled: p.monetizationEnabled,
              media: p.media ?? [],
              longPost: p.longPost,
            },
            viewerUserId,
          );
        return this.enrichPostPlayback(p, fileByUrl, locked);
      }),
    );
  }

  async createPost(
    data: CreatePostDto,
    published: boolean,
    email: string,
  ): Promise<Post> {
    try {
      const isShortPostEmpty =
        data.type === PostType.SHORT &&
        !data.text?.length &&
        !data.media?.length;
      const isLongPostEmpty =
        data.type === PostType.LONG &&
        (!data.longPost ||
          !data.longPost.content ||
          data.longPost.content.length === 0);

      if (data.type === PostType.SHORT && isShortPostEmpty) {
        throw new BadRequestException('Short post cannot be empty');
      } else if (data.type === PostType.LONG && isLongPostEmpty) {
        throw new BadRequestException('Long post cannot be empty');
      }

      if (data.monetizationEnabled && !data.videoCategory) {
        throw new BadRequestException(
          'videoCategory is required when monetization is enabled',
        );
      }

      const fileIds = data.media ?? [];
      const clone = data.longPost?.content;

      if (fileIds.length > 0 && data.type !== PostType.LONG) {
        const res = await this.fileService.getFilesUrls(data.media as any);
        data.media = res.map((file) => file.url);
        data.mediaTypes = res.map((file) => file.type);
      }
      if (data.type === PostType.LONG) {
        try {
          const contents = await Promise.all(
            data.longPost.content.map(async (c) => {
              const res = await this.fileService.getFilesUrls(c.media);
              return res[0];
            }),
          );

          data.longPost.content = data.longPost.content.map((c, index) => ({
            ...c,
            media: [contents[index].url],
            mediaTypes: [contents[index].type],
          }));
        } catch (error) {
          console.error('Error uploading files:', error);
          throw new BadRequestException(
            'We could not attach your media to this post. Check that files uploaded correctly and try again.',
          );
        }
      }
      const { parentId, videoDurationSeconds, ...rest } = data;
      void videoDurationSeconds;
      const createData: Prisma.PostCreateInput = {
        parent: parentId ? { connect: { id: parentId } } : undefined,
        ...rest,
        author: { connect: { email } },
        longPost:
          data.longPost && data.longPost.content.length > 0
            ? {
                create: {
                  content: {
                    createMany: {
                      data: data.longPost.content.map((c) => ({
                        text: c.text,
                        media: c.media,
                        mediaTypes: c.mediaTypes,
                      })),
                      skipDuplicates: true,
                    },
                  },
                },
              }
            : undefined,

        published,
      };

      const { id: postId } = await this.prisma.post.create({
        data: createData,
        select: { id: true },
      });

      //Mark uploaded for short posts
      if (fileIds.length > 0)
        await this.fileService.markFileAsUploaded(fileIds);

      //Mark uploaded for long posts
      if (data.type === PostType.LONG && clone && clone.length > 0) {
        await Promise.all(
          clone.map(async (c) => {
            await this.fileService.markFileAsUploaded(c.media);
          }),
        );
      }

      await this.syncMonetizationPricingToDb(postId);

      const post = await this.loadPostAfterWrite(postId);

      if (
        post.monetizationEnabled &&
        (!post.pricedCostMinor || post.pricedCostMinor <= 0)
      ) {
        throw new BadRequestException(
          'Could not compute a coin price from your videos. Use at least one video file; ensure ffprobe is available (set FFPROBE_PATH if needed).',
        );
      }

      if (post.parentId) {
        await this.incrementParentPostCommentCount(post.parentId, email);
      }

      if (published) {
        await this.createNotification({
          parent_id: parentId,
          post,
          label: parentId ? 'comment.added' : 'post.created',
        });
        void this.notifyMentionsForPost(post).catch((err) =>
          this.logger.warn(`notifyMentionsForPost failed: ${String(err)}`),
        );
      }

      const viewerUserId = await this.viewerUserIdFromEmail(email);
      return this.withMediaPlayback(post, viewerUserId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('Post creation failed:', error);
      throw new InternalServerErrorException('Post creation failed');
    }
  }

  async createNotification(options: {
    parent_id?: string;
    post: Post & {
      author?: {
        id: string;
        name: string;
        img: string | null;
        username: string;
      };
    };
    label: NotificationTypes;
  }) {
    if (options.label === 'post.liked') {
      return;
    }

    if (!options.parent_id) {
      return;
    }

    const parent_post = await this.findParentPost(options.parent_id, false);
    if (parent_post.authorId === options.post.authorId) {
      return;
    }

    const recipient = await this.prisma.user.findUnique({
      where: { id: parent_post.authorId },
    });
    if (!recipient) {
      return;
    }

    const commenter = options.post.author;
    const commenterName = commenter?.name ?? 'Someone';

    await this.notificationService.create({
      user: recipient,
      description: `${commenterName} replied to you`,
      type: NotificationType.COMMENT_ADDED,
      author: commenter
        ? {
            id: commenter.id,
            name: commenter.name,
            img: commenter.img ?? undefined,
            username: commenter.username,
          }
        : undefined,
      postId: parent_post.id,
      commentId: options.post.id,
    });
  }

  private collectTextsForMentionsFromPost(post: {
    text?: string | null;
    longPost?: { content?: Array<{ text?: string | null }> } | null;
  }): (string | null | undefined)[] {
    const texts: (string | null | undefined)[] = [post.text];
    for (const block of post.longPost?.content ?? []) {
      texts.push(block.text);
    }
    return texts;
  }

  private extractMentionUsernames(
    texts: (string | null | undefined)[],
  ): string[] {
    const re = /@([\w]+)/g;
    const out = new Set<string>();
    for (const t of texts) {
      if (!t) continue;
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(t)) !== null) {
        out.add(m[1]);
      }
    }
    return [...out];
  }

  private async notifyMentionsForPost(
    post: Post & {
      author?: {
        id: string;
        name: string;
        img: string | null;
        username: string;
      };
    },
  ): Promise<void> {
    const handles = this.extractMentionUsernames(
      this.collectTextsForMentionsFromPost(post),
    );
    if (handles.length === 0) {
      return;
    }

    const authorId = post.authorId;
    const authorPartial = post.author;

    for (const username of handles) {
      const mentioned = await this.prisma.user.findFirst({
        where: { username: { equals: username, mode: 'insensitive' } },
      });
      if (!mentioned || mentioned.id === authorId) {
        continue;
      }

      await this.notificationService.create({
        user: mentioned as User,
        type: NotificationType.USER_MENTIONED,
        description: `${authorPartial?.name ?? 'Someone'} mentioned you in a post`,
        author: authorPartial
          ? {
              id: authorPartial.id,
              name: authorPartial.name,
              img: authorPartial.img ?? undefined,
              username: authorPartial.username,
            }
          : undefined,
        postId: post.id,
        mentionedUserId: mentioned.id,
      });
    }
  }

  private async notifyPostLiked(
    post: Post & {
      author?: {
        id: string;
        name: string;
        img: string | null;
        username: string;
      };
    },
    liker: User,
  ): Promise<void> {
    if (post.authorId === liker.id) {
      return;
    }

    const recipient = await this.prisma.user.findUnique({
      where: { id: post.authorId },
    });
    if (!recipient) {
      return;
    }

    await this.notificationService.create({
      user: recipient,
      type: NotificationType.POST_LIKED,
      description: `${liker.name} liked your post`,
      author: {
        id: liker.id,
        name: liker.name,
        img: liker.img,
        username: liker.username,
      },
      postId: post.id,
    });
  }

  async findParentPost(
    postId: string,
    with_author?: boolean,
  ): Promise<Post | null> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: with_author,
      },
    });

    if (!post) {
      throw new NotFoundException('Parent post not found');
    }

    return post;
  }

  async incrementParentPostCommentCount(
    postId: string,
    email: string,
  ): Promise<Post> {
    const parentPost = await this.findParentPost(postId);

    return this.updatePost({
      where: { id: postId },
      data: { commentCount: parentPost.commentCount + 1 },
      email,
    });
  }

  async viewSinglePost(postId: string, email: string): Promise<Post> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        comments: false,
        author: {
          select: {
            id: true,
            name: true,
            img: true,
            username: true,
          },
        },
        likedBy: true,
        bookmarkedBy: true,
        longPost: {
          select: {
            id: true,
            content: true,
          },
        },
      },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const postWithUserFlags = {
      ...post,
      author: post.author,

      likedByMe: email
        ? post.likedBy.some((user) => user.email === email)
        : false,
      bookmarkedByMe: email
        ? post.bookmarkedBy.some((user) => user.email === email)
        : false,
    };

    const viewerUserId = await this.viewerUserIdFromEmail(email);
    return this.withMediaPlayback(
      postWithUserFlags as PostWithLongPostMedia,
      viewerUserId,
    );
  }

  async checkIfUserLikedPost(
    postId: string,
    email: string,
  ): Promise<{ status: boolean }> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { likedBy: true },
    });

    return { status: post.likedBy.some((user) => user.email === email) };
  }

  async checkIfUserBookmarkedPost(
    postId: string,
    email: string,
  ): Promise<{ status: boolean }> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { bookmarkedBy: true },
    });

    return { status: post.bookmarkedBy.some((user) => user.email === email) };
  }

  async getMultiplePosts(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.PostWhereUniqueInput;
    where?: Prisma.PostWhereInput;
    orderBy?: Prisma.PostOrderByWithRelationInput;
    currentUserEmail?: string;
  }): Promise<Post[]> {
    const { skip, take, cursor, where, orderBy } = params;
    const posts = await this.prisma.post.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      include: {
        likedBy: true,
        bookmarkedBy: true,
        author: {
          select: {
            id: true,
            name: true,
            img: true,
            username: true,
          },
        },
        longPost: {
          select: {
            id: true,
            content: true,
          },
        },
      },
    });

    const postsWithUserFlags = posts.map((post) => {
      return {
        ...post,
        author: post.author,

        likedByMe: params.currentUserEmail
          ? post.likedBy.some((user) => user.email === params.currentUserEmail)
          : false,
        bookmarkedByMe: params.currentUserEmail
          ? post.bookmarkedBy.some(
              (user) => user.email === params.currentUserEmail,
            )
          : false,
      };
    });

    const viewerUserId = await this.viewerUserIdFromEmail(
      params.currentUserEmail,
    );
    return this.withMediaPlaybackMany(
      postsWithUserFlags as PostWithLongPostMedia[],
      viewerUserId,
    );
  }

  async updatePost(params: {
    where: Prisma.PostWhereUniqueInput;
    data: Prisma.PostUpdateInput;
    email: string;
  }): Promise<Post> {
    const { data, where } = params;

    const { id: postId } = await this.prisma.post.update({
      data,
      where,
      select: { id: true },
    });

    await this.syncMonetizationPricingToDb(postId);

    const post = await this.loadPostAfterWrite(postId);

    const postWithUserFlags = {
      ...post,
      author: post.author,

      likedByMe: post.likedBy.some((user) => user.email === params.email),
      bookmarkedByMe: post.bookmarkedBy.some(
        (user) => user.email === params.email,
      ),
    };

    const viewerUserId = await this.viewerUserIdFromEmail(params.email);
    return this.withMediaPlayback(
      postWithUserFlags as PostWithLongPostMedia,
      viewerUserId,
    );
  }

  async likePost(
    postId: string,
    email: string,
    desiredLiked?: boolean,
  ): Promise<Post> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const post = await this.prisma.post.findUnique({
        where: { id: postId },
        include: { bookmarkedBy: true },
      });

      if (!post) {
        throw new NotFoundException('Post not found');
      }

      const likedBefore = (await this.checkIfUserLikedPost(postId, email))
        .status;
      const targetLiked =
        desiredLiked !== undefined ? desiredLiked : !likedBefore;

      if (targetLiked === likedBefore) {
        return await this.viewSinglePost(postId, email);
      }

      const updated_post = await this.updatePost({
        where: { id: postId },
        data: {
          likedBy: targetLiked
            ? { connect: { email } }
            : { disconnect: { email } },
          likeCount: targetLiked ? post.likeCount + 1 : post.likeCount - 1,
        },
        email,
      });

      if (targetLiked && !likedBefore) {
        void this.notifyPostLiked(updated_post, user).catch((err) =>
          this.logger.warn(`notifyPostLiked failed: ${String(err)}`),
        );
      }

      return updated_post;
    } catch (error) {
      console.log(error);
    }
  }

  async bookmarkPost(
    postId: string,
    email: string,
    desiredBookmarked?: boolean,
  ): Promise<Post> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { bookmarkedBy: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const bookmarkedBefore = (
      await this.checkIfUserBookmarkedPost(postId, email)
    ).status;
    const targetBookmarked =
      desiredBookmarked !== undefined
        ? desiredBookmarked
        : !bookmarkedBefore;

    if (targetBookmarked === bookmarkedBefore) {
      return await this.viewSinglePost(postId, email);
    }

    return this.updatePost({
      where: { id: postId },
      data: {
        bookmarkedBy: targetBookmarked
          ? { connect: { email } }
          : { disconnect: { email } },
        bookmarkCount: targetBookmarked
          ? post.bookmarkCount + 1
          : post.bookmarkCount - 1,
      },
      email,
    });
  }

  async getPostLikes(postId: string): Promise<number> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { likedBy: true },
    });
    return post.likedBy.length;
  }

  async getPostBookmarks(postId: string): Promise<number> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { bookmarkedBy: true },
    });

    return post.bookmarkedBy.length;
  }

  async getPostComments(postId: string): Promise<Post> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { comments: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const fileByUrl = await this.fileService.findFilesByUrls(
      this.collectMediaUrlsFromPosts([post, ...post.comments]),
    );
    const enrichedMain = this.enrichPostPlayback(post, fileByUrl, new Set());
    const enrichedComments = post.comments.map((c) =>
      this.enrichPostPlayback(c, fileByUrl, new Set()),
    );
    return { ...enrichedMain, comments: enrichedComments } as Post;
  }

  async deletePost(where: Prisma.PostWhereUniqueInput): Promise<Post> {
    return this.prisma.post.delete({
      where,
    });
  }
}
