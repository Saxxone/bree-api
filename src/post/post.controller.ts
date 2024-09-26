import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Put,
  Delete,
  Request,
  Query,
} from '@nestjs/common';
import { PostService } from './post.service';
import { Post as PostModel} from '@prisma/client';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post('create-draft')
  async createDraft(
    @Request() req: any,
    @Body() postData: { text?: string; media?: any },
  ): Promise<PostModel> {
    const { text, media } = postData;

    return await this.postService.createDraft({
      text,
      media,
      author: {
        connect: { email: req.user.sub },
      },
    });
  }

  @Post('create-post')
  async createPost(
    @Request() req: any,
    @Body() postData: { text?: string; media?: any; parentId?: string },
  ): Promise<PostModel> {
    const { text, media, parentId } = postData;

    return await this.postService.createPost({
      text,
      media,
      author: {
        connect: { email: req.user.sub },
      },
      ...(parentId && {
        parent: {
          connect: { id: parentId },
        },
      }),
    });
  }

  @Put('publish/:id')
  async publishPost(@Param('id') id: string): Promise<PostModel> {
    return await this.postService.updatePost({
      where: { id: String(id) },
      data: { published: true },
    });
  }

  @Put('bookmark/:id')
  async bookmarkPost(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<PostModel> {
    return await this.postService.bookmarkPost(id, req.user.sub);
  }

  @Put('like/:id')
  async likePost(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<PostModel> {
    return await this.postService.likePost(id, req.user.sub);
  }

  @Get('/:id')
  async getPostById(@Param('id') id: string): Promise<PostModel> {
    return await this.postService.viewSinglePost(id);
  }

  @Get('/comments/:id')
  async getCommentsForPost(@Param('id') id: string): Promise<PostModel[]> {
    return await this.postService.getMultiplePosts({
      where: { parent: { id: id } },
    });
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

  @Post('feed')
  async getPublishedPosts(@Param() params: any,
  @Query('skip') skip?: number,
  @Query('take') take?: number,
  @Query('cursor') cursor?: string,
  ): Promise<PostModel[]> {
    return await this.postService.getMultiplePosts({
      where: { published: true },
      orderBy: {
        createdAt: 'desc',
      },
      skip: Number(skip),
      take: Number(take),
    });
  }

  @Get('filtered-posts/:searchString')
  async getFilteredPosts(
    @Param('searchString') searchString: string,
  ): Promise<PostModel[]> {
    return await this.postService.getMultiplePosts({
      where: {
        text: { contains: searchString },
      },
    });
  }

  @Delete('post/:id')
  async deletePost(@Param('id') id: string): Promise<PostModel> {
    return await this.postService.deletePost({ id: String(id) });
  }
}
