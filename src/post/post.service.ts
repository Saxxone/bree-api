import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Post, Prisma } from '@prisma/client';
import { PostDto } from './dto/create-post.dto';

@Injectable()
export class PostService {
  constructor(private prisma: PrismaService) {}

  async createDraft(data: Prisma.PostCreateInput): Promise<Post> {
    return this.prisma.post.create({
      data,
    });
  }

  async createPost(data: Prisma.PostCreateInput): Promise<Post> {
    const post = await this.prisma.post.create({
      data,
    });

    return this.updatePost({
      where: { id: post.id },
      data: { published: true },
    });
  }

  async findPost(
    postId: string,
  ): Promise<Post | null> {
  const post = await this.prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async viewSinglePost(postId: string): Promise<Post> {
    return this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        comments: true,
        author: true,
        likedBy: true,
        bookmarkedBy: true,
      },
    });
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
  }): Promise<Post[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.post.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      include: { author: true },
    });
  }

  async updatePost(params: {
    where: Prisma.PostWhereUniqueInput;
    data: Prisma.PostUpdateInput;
  }): Promise<Post> {
    const { data, where } = params;
   
    return this.prisma.post.update({
      data,
      where,
      include: { author: true },
    });
  }

  async likePost(postId: string, email: string): Promise<Post> {
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

    const status = (await this.checkIfUserLikedPost(postId, email)).status;
    return this.updatePost({
      where: { id: postId },
      data: {
        likedBy: status
          ? { disconnect: { email } } 
          : { connect: { email } },
          likeCount: status
          ? post.likeCount - 1
          : post.likeCount + 1,
      },
    })
  };


  async bookmarkPost(postId: string, email: string): Promise<Post> {
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
  
    const status = (await this.checkIfUserBookmarkedPost(postId, email)).status;

    return this.updatePost({
      where: { id: postId },
      data: {
        bookmarkedBy: status
          ? { disconnect: { email } } 
          : { connect: { email } },
        bookmarkCount: status
          ? post.bookmarkCount - 1
          : post.bookmarkCount + 1,
      },
    })
  };

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

    return post;
  }

  async deletePost(where: Prisma.PostWhereUniqueInput): Promise<Post> {
    return this.prisma.post.delete({
      where,
    });
  }
}
