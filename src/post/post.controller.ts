import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
} from '@nestjs/common';
import { Post as PostModel, Prisma } from '@prisma/client';
import { Public } from 'src/auth/auth.guard';
import { CreatePostDto } from './dto/create-post.dto';
import { PostService } from './post.service';

function parseLikeStatus(
  status: string | boolean | string[] | undefined,
): boolean | undefined {
  if (status === undefined) return undefined;
  const v = Array.isArray(status) ? status[0] : status;
  if (v === true || v === 'true' || v === '1') return true;
  if (v === false || v === 'false' || v === '0') return false;
  return undefined;
}

function parsePostListPagination(q: {
  skip?: number | string;
  take?: number | string;
  cursor?: string | string[];
}): { skip?: number; take?: number; cursor?: Prisma.PostWhereUniqueInput } {
  const take = Math.min(Math.max(Number(q.take) || 10, 1), 100);
  const skipRaw = Math.max(Number(q.skip) || 0, 0);
  const raw = q.cursor;
  const cursorStr =
    raw == null ? '' : Array.isArray(raw) ? String(raw[0] ?? '') : String(raw);
  const trimmed = cursorStr.trim();
  if (trimmed) {
    return {
      take,
      skip: 1,
      cursor: { id: trimmed },
    };
  }
  return { take, skip: skipRaw, cursor: undefined };
}

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post('create-draft')
  async createDraft(
    @Request() req: any,
    @Body() postData: CreatePostDto,
  ): Promise<PostModel> {
    return await this.postService.createPost(
      {
        ...postData,
        ...(postData.type && { type: postData.type }),
        ...(postData.longPost && {
          longPost: postData.longPost,
        }),
      },
      false,
      req.user.sub,
    );
  }

  @Post('create-post')
  async createPost(
    @Request() req: any,
    @Body() postData: CreatePostDto,
  ): Promise<PostModel> {
    return await this.postService.createPost(
      {
        ...postData,
        ...(postData.type && { type: postData.type }),
        ...(postData.longPost && {
          longPost: postData.longPost,
        }),
      },
      true,
      req.user.sub,
    );
  }

  @Put('publish/:id')
  async publishPost(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<PostModel> {
    return await this.postService.updatePost({
      where: { id: String(id) },
      data: { published: true },
      email: req.user.sub,
    });
  }

  @Put('bookmark/:id')
  async bookmarkPost(
    @Param('id') id: string,
    @Request() req: any,
    @Query('status') status?: string | boolean | string[],
  ): Promise<PostModel> {
    return await this.postService.bookmarkPost(
      id,
      req.user.sub,
      parseLikeStatus(status),
    );
  }

  @Put('like/:id')
  async likePost(
    @Param('id') id: string,
    @Request() req: any,
    @Query('status') status?: string | boolean | string[],
  ): Promise<PostModel> {
    return await this.postService.likePost(
      id,
      req.user.sub,
      parseLikeStatus(status),
    );
  }

  @Post('watch/:id')
  async recordWatch(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<{ recorded: boolean }> {
    return await this.postService.recordWatch(String(id), req.user.sub);
  }

  @Get('me/watch-history')
  async getMyWatchHistory(
    @Request() req: any,
    @Query('skip') skipQ?: number | string,
    @Query('take') takeQ?: number | string,
    @Query('cursor') cursorQ?: string | string[],
  ): Promise<PostModel[]> {
    const page = parsePostListPagination({
      skip: skipQ,
      take: takeQ,
      cursor: cursorQ,
    });
    return await this.postService.getMyWatchHistory(req.user.sub, {
      skip: page.skip,
      take: page.take,
    });
  }

  @Get('me/liked-videos')
  async getMyLikedVideos(
    @Request() req: any,
    @Query('skip') skipQ?: number | string,
    @Query('take') takeQ?: number | string,
    @Query('cursor') cursorQ?: string | string[],
  ): Promise<PostModel[]> {
    const page = parsePostListPagination({
      skip: skipQ,
      take: takeQ,
      cursor: cursorQ,
    });
    return await this.postService.getMyLikedVideos(req.user.sub, {
      skip: page.skip,
      take: page.take,
      cursor: page.cursor,
    });
  }

  @Get('me/unlocked')
  async getMyUnlockedPosts(
    @Request() req: any,
    @Query('skip') skipQ?: number | string,
    @Query('take') takeQ?: number | string,
    @Query('cursor') cursorQ?: string | string[],
  ): Promise<PostModel[]> {
    const page = parsePostListPagination({
      skip: skipQ,
      take: takeQ,
      cursor: cursorQ,
    });
    return await this.postService.getMyUnlockedPosts(req.user.sub, {
      skip: page.skip,
      take: page.take,
    });
  }

  /** Must be registered before `@Get('/:id')` so `/posts/comments/:id` matches. */
  @Get('/comments/:id')
  async getCommentsForPost(
    @Request() req: any,
    @Param('id') id: string,
    @Query('skip') skipQ?: number | string,
    @Query('take') takeQ?: number | string,
    @Query('cursor') cursorQ?: string | string[],
  ): Promise<PostModel[]> {
    const page = parsePostListPagination({
      skip: skipQ,
      take: takeQ,
      cursor: cursorQ,
    });
    return await this.postService.getMultiplePosts({
      where: { parent: { id: id } },
      orderBy: { createdAt: 'desc' },
      skip: page.skip,
      take: page.take,
      cursor: page.cursor,
      currentUserEmail: req.user?.sub,
    });
  }

  @Public()
  @Get('/:id')
  async getPostById(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<PostModel> {
    return await this.postService.viewSinglePost(id, req.user?.sub);
  }

  @Post('/check-like/:id')
  async checkLikedByUser(
    @Param('id') id: string,
    @Request() req: any,
    @Body() postData: { email?: string },
  ): Promise<{ status: boolean }> {
    return await this.postService.checkIfUserLikedPost(
      id,
      postData.email ?? req.user.sub,
    );
  }

  @Post('/check-bookmark/:id')
  async checkBookmarkedByUser(
    @Param('id') id: string,
    @Request() req: any,
    @Body() postData: { email?: string },
  ): Promise<{ status: boolean }> {
    return await this.postService.checkIfUserBookmarkedPost(
      id,
      postData.email ?? req.user.sub,
    );
  }

  /**
   * @returns post feed ranked by content class (video, root posts, replies) then recency;
   * when `cursor` is set, falls back to chronological listing for stable cursor semantics.
   */
  @Public()
  @Post('feed')
  async getPublishedPosts(
    @Request() req: any,
    @Query('skip') skipQ?: number | string,
    @Query('take') takeQ?: number | string,
    @Query('cursor') cursorQ?: string | string[],
  ): Promise<PostModel[]> {
    const page = parsePostListPagination({
      skip: skipQ,
      take: takeQ,
      cursor: cursorQ,
    });
    if (page.cursor) {
      return await this.postService.getMultiplePosts({
        where: { published: true },
        orderBy: {
          createdAt: 'desc',
        },
        skip: page.skip,
        take: page.take,
        cursor: page.cursor,
        currentUserEmail: req.user?.sub,
      });
    }
    return await this.postService.getFeedPosts({
      skip: page.skip ?? 0,
      take: page.take ?? 10,
      currentUserEmail: req.user?.sub,
    });
  }

  /**
   * @param {string} id the id of the user whose posts should be returned
   * @returns post feed in descending order based on the skip and take values and the user id
   */
  @Get('user/:id/posts')
  async getUserPosts(
    @Param('id') id: string,
    @Request() req: any,
    @Query('skip') skipQ?: number | string,
    @Query('take') takeQ?: number | string,
    @Query('cursor') cursorQ?: string | string[],
  ): Promise<PostModel[]> {
    const searchTerm = id.startsWith('@') ? id.substring(1) : id;
    const page = parsePostListPagination({
      skip: skipQ,
      take: takeQ,
      cursor: cursorQ,
    });
    return await this.postService.getMultiplePosts({
      where: {
        published: true,
        author: { OR: [{ username: searchTerm }, { email: id }, { id: id }] },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: page.skip,
      take: page.take,
      cursor: page.cursor,
      currentUserEmail: req.user.sub,
    });
  }

  @Post('/search')
  async getFilteredPosts(
    @Request() req: any,
    @Query('q') q?: string,
    @Query('skip') skipQ?: number | string,
    @Query('take') takeQ?: number | string,
    @Query('cursor') cursorQ?: string | string[],
  ): Promise<PostModel[]> {
    const page = parsePostListPagination({
      skip: skipQ,
      take: takeQ,
      cursor: cursorQ,
    });
    const raw = (q ?? '').trim();
    if (!raw) {
      return await this.postService.getMultiplePosts({
        where: { published: true },
        orderBy: { createdAt: 'desc' },
        skip: page.skip,
        take: page.take,
        cursor: page.cursor,
        currentUserEmail: req.user.sub,
      });
    }

    const cleanedQuery = raw.replace(/[^a-zA-Z0-9\s]/g, ' ');
    const terms = cleanedQuery.split(/\s+/).filter(Boolean);
    if (!terms.length) {
      return await this.postService.getMultiplePosts({
        where: { published: true },
        orderBy: { createdAt: 'desc' },
        skip: page.skip,
        take: page.take,
        cursor: page.cursor,
        currentUserEmail: req.user.sub,
      });
    }

    const textClause =
      terms.length <= 1
        ? {
            text: {
              contains: terms[0] ?? cleanedQuery,
              mode: 'insensitive' as const,
            },
          }
        : {
            OR: terms.map((term) => ({
              text: { contains: term, mode: 'insensitive' as const },
            })),
          };

    return await this.postService.getMultiplePosts({
      where: {
        published: true,
        ...textClause,
      },
      orderBy: { createdAt: 'desc' },
      skip: page.skip,
      take: page.take,
      cursor: page.cursor,
      currentUserEmail: req.user.sub,
    });
  }

  @Delete(':id')
  async deletePost(@Param('id') id: string): Promise<PostModel> {
    return await this.postService.deletePost({ id: String(id) });
  }
}
