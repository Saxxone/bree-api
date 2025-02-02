import {
  BadRequestException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { NotificationType, Post, PostType, Prisma } from '@prisma/client';
import { FileService } from 'src/file/file.service';
import { NotificationTypes } from 'src/notification/dto/create-notification.dto';
import { NotificationService } from 'src/notification/notification.service';
import { UserService } from 'src/user/user.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
  ) {}

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

      const fileIds = data.media;
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
          throw new Error('Failed to process long post media.');
        }
      }
      const { parentId, ...rest } = data;
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

      const post = await this.prisma.post.create({
        data: createData,
        include: {
          likedBy: true,
          bookmarkedBy: true,
          author: {
            select: {
              id: true,
              name: true,
              img: true,
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

      //Mark uploaded for short posts
      if (fileIds.length > 0)
        await this.fileService.markFileAsUploaded(fileIds);

      //Mark uploaded for long posts
      if (data.type === PostType.LONG && clone.length > 0) {
        await Promise.all(
          clone.map(async (c) => {
            await this.fileService.markFileAsUploaded(c.media);
          }),
        );
      }

      if (post.parentId)
        this.incrementParentPostCommentCount(post.parentId, email);

      await this.createNotification({
        parent_id: parentId,
        post: post,
        label: parentId ? 'comment.added' : 'post.created',
      });

      return post;
    } catch {
      throw new NotImplementedException('Post creation failed');
    }
  }

  async createNotification(options: {
    parent_id: string;
    post: Post;
    label: NotificationTypes;
  }) {
    const parent_post = await this.findParentPost(options.parent_id, true);

    //@ts-expect-error: userService.findUser may not have the correct type
    const user = await this.userService.findUser(parent_post.author.id);

    this.notificationService.create({
      user: user,
      description: 'New post created',
      type: NotificationType.COMMENT_ADDED,
      //@ts-expect-error: userService.findUser may not have the correct type
      description: `${parent_post.author.name} commented on your post`,
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

    return postWithUserFlags;
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

    return postsWithUserFlags;
  }

  async updatePost(params: {
    where: Prisma.PostWhereUniqueInput;
    data: Prisma.PostUpdateInput;
    email: string;
  }): Promise<Post> {
    const { data, where } = params;

    const post = await this.prisma.post.update({
      data,
      where,
      include: {
        likedBy: true,
        bookmarkedBy: true,
        author: {
          select: {
            id: true,
            name: true,
            img: true,
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

    const postWithUserFlags = {
      ...post,
      author: post.author,

      likedByMe: post.likedBy.some((user) => user.email === params.email),
      bookmarkedByMe: post.bookmarkedBy.some(
        (user) => user.email === params.email,
      ),
    };

    return postWithUserFlags;
  }

  async likePost(postId: string, email: string): Promise<Post> {
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

      const status = (await this.checkIfUserLikedPost(postId, email)).status;
      const updated_post = await this.updatePost({
        where: { id: postId },
        data: {
          likedBy: status ? { disconnect: { email } } : { connect: { email } },
          likeCount: status ? post.likeCount - 1 : post.likeCount + 1,
        },
        email,
      });

      this.createNotification({
        label: 'post.liked',
        parent_id: null,
        post: updated_post,
      });

      return updated_post;

    } catch (error) {
      console.log(error);
    }
  }

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
        bookmarkCount: status ? post.bookmarkCount - 1 : post.bookmarkCount + 1,
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

    return post;
  }

  async deletePost(where: Prisma.PostWhereUniqueInput): Promise<Post> {
    return this.prisma.post.delete({
      where,
    });
  }
}
