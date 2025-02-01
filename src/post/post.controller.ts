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
import { Post as PostModel } from '@prisma/client';
import { Public } from 'src/auth/auth.guard';
import { CreatePostDto } from './dto/create-post.dto';
import { PostService } from './post.service';

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

  @Public()
  @Get('/:id')
  async getPostById(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<PostModel> {
    return await this.postService.viewSinglePost(id, req.user?.sub);
  }

  @Get('/comments/:id')
  async getCommentsForPost(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<PostModel[]> {
    return await this.postService.getMultiplePosts({
      where: { parent: { id: id } },
      currentUserEmail: req.user?.sub,
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

  /**
   * @returns post feed in descending order based on the skip and take values
   */
  @Public()
  @Post('feed')
  async getPublishedPosts(
    @Request() req: any,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ): Promise<PostModel[]> {
    return await this.postService.getMultiplePosts({
      where: { published: true },
      orderBy: {
        createdAt: 'desc',
      },
      skip: Number(skip) || 0,
      take: Number(take) || 10,
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
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ): Promise<PostModel[]> {
    const searchTerm = id.startsWith('@') ? id.substring(1) : id;
    return await this.postService.getMultiplePosts({
      where: {
        published: true,
        author: { OR: [{ username: searchTerm }, { email: id }, { id: id }] },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: Number(skip) || 0,
      take: Number(take) || 10,
      currentUserEmail: req.user.sub,
    });
  }

  @Post('/search')
  async getFilteredPosts(
    @Request() req: any,
    @Query('q') q?: string,
  ): Promise<PostModel[]> {
    const cleanedQuery = q.trim().replace(/[^a-zA-Z0-9\s]/g, ' ');

    const query =
      cleanedQuery.split(/[ \+]/).length > 1
        ? cleanedQuery.split(' ').join(' | ')
        : cleanedQuery;

    return await this.postService.getMultiplePosts({
      where: {
        published: true,
        text: {
          search: query,
        },
      },
      currentUserEmail: req.user.sub,
    });
  }

  @Delete('post/:id')
  async deletePost(@Param('id') id: string): Promise<PostModel> {
    return await this.postService.deletePost({ id: String(id) });
  }
}
