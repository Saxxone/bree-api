import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Put,
  Delete,
  Request,
} from '@nestjs/common';
import { PostService } from './post.service';
import { Post as PostModel } from '@prisma/client';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post('create-draft')
  async createDraft(
    @Request() req: any,
    @Body() postData: { text?: string; img?: any },
  ): Promise<PostModel> {
    const { text, img } = postData;

    return this.postService.createDraft({
      text,
      author: {
        connect: { email: req.user.sub },
      },
    });
  }

  @Post('create-post')
  async createPost(
    @Request() req: any,
    @Body() postData: { text?: string; img?: any },
  ): Promise<PostModel> {
    const { text, img } = postData;

    return this.postService.createPost({
      text,
      author: {
        connect: { email: req.user.sub },
      },
    });
  }

  @Put('publish/:id')
  async publishPost(@Param('id') id: string): Promise<PostModel> {
    return this.postService.updatePost({
      where: { id: String(id) },
      data: { published: true },
    });
  }

  @Put('bookmark/:id')
  async bookmarkPost(@Param('id') id: string, @Request() req: any): Promise<PostModel> {
    return this.postService.updatePost({
      where: { id: String(id) },
      data: { bookmarkedBy: { connect: { email: req.user.sub } } },
    });
  }

  @Put('like/:id')
  async likePost(@Param('id') id: string, @Request() req: any): Promise<PostModel> {
    return this.postService.updatePost({
      where: { id: String(id) },
      data: { likedBy: { connect: { email: req.user.sub } } },
    });
  }

  @Get('/:id')
  async getPostById(@Param('id') id: string): Promise<PostModel> {
    return this.postService.findPost({ id: String(id) });
  }

  @Post('feed')
  async getPublishedPosts(): Promise<PostModel[]> {
    return await this.postService.getMultiplePosts({
      where: { published: true },
    });
  }

  @Get('filtered-posts/:searchString')
  async getFilteredPosts(
    @Param('searchString') searchString: string,
  ): Promise<PostModel[]> {
    return this.postService.getMultiplePosts({
      where: {
        text: { contains: searchString },
      },
    });
  }

  @Delete('post/:id')
  async deletePost(@Param('id') id: string): Promise<PostModel> {
    return this.postService.deletePost({ id: String(id) });
  }
}
