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

@Controller('post')
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

  @Get('/:id')
  async getPostById(@Param('id') id: string): Promise<PostModel> {
    return this.postService.findPost({ id: String(id) });
  }

  @Get('feed')
  async getPublishedPosts(): Promise<PostModel[]> {
    return this.postService.getMultiplePosts({
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
