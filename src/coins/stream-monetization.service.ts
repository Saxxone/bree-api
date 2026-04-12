import { ForbiddenException, Injectable } from '@nestjs/common';
import { Status } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

type PostWithMedia = {
  id: string;
  authorId: string;
  published: boolean | null;
  monetizationEnabled: boolean;
  media: string[];
  longPost?: {
    content?: Array<{ media: string[] }>;
  } | null;
};

@Injectable()
export class StreamMonetizationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * File IDs that belong to this post's video/audio and should be paywalled
   * when the viewer has not unlocked.
   */
  async getMonetizedVideoFileIdsForPost(postId: string): Promise<Set<string>> {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        deletedAt: null,
        monetizationEnabled: true,
        published: true,
      },
      include: {
        longPost: {
          select: {
            content: { select: { media: true } },
          },
        },
      },
    });
    if (!post) {
      return new Set();
    }

    const urls: string[] = [...(post.media ?? [])];
    for (const b of post.longPost?.content ?? []) {
      urls.push(...(b.media ?? []));
    }

    if (urls.length === 0) {
      return new Set();
    }

    const files = await this.prisma.file.findMany({
      where: {
        OR: [{ url: { in: urls } }, { path: { in: urls } }],
        type: { in: ['video', 'audio'] },
        status: { not: Status.DELETED },
      },
      select: { id: true },
    });

    return new Set(files.map((f) => f.id));
  }

  async getUnlockMapForUser(
    userId: string,
    postIds: string[],
  ): Promise<Map<string, boolean>> {
    if (postIds.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.postUnlock.findMany({
      where: { userId, postId: { in: postIds } },
      select: { postId: true },
    });
    const set = new Set(rows.map((r) => r.postId));
    const m = new Map<string, boolean>();
    for (const id of postIds) {
      m.set(id, set.has(id));
    }
    return m;
  }

  async assertStreamAllowed(
    fileId: string,
    viewerUserId: string | undefined,
  ): Promise<void> {
    const blocked = await this.shouldBlockStreamForFile(fileId, viewerUserId);
    if (blocked) {
      throw new ForbiddenException(
        'Unlock this content with coins to stream this media',
      );
    }
  }

  /**
   * Whether this file should be withheld from streaming for the viewer.
   */
  async shouldBlockStreamForFile(
    fileId: string,
    viewerUserId: string | undefined,
  ): Promise<boolean> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: { id: true, url: true, path: true, ownerId: true, type: true },
    });
    if (!file || (file.type !== 'video' && file.type !== 'audio')) {
      return false;
    }
    if (!viewerUserId) {
      return await this.fileUsedInLockedMonetizedPost(file.url, file.path);
    }
    if (file.ownerId === viewerUserId) {
      return false;
    }

    const posts = await this.findMonetizedPostsReferencingFile(
      file.url,
      file.path,
    );
    for (const p of posts) {
      if (p.authorId === viewerUserId) {
        continue;
      }
      const unlocked = await this.prisma.postUnlock.findUnique({
        where: {
          userId_postId: { userId: viewerUserId, postId: p.id },
        },
      });
      if (!unlocked) {
        return true;
      }
    }
    return false;
  }

  private async fileUsedInLockedMonetizedPost(
    url: string,
    path: string,
  ): Promise<boolean> {
    const posts = await this.findMonetizedPostsReferencingFile(url, path);
    return posts.length > 0;
  }

  private async findMonetizedPostsReferencingFile(url: string, path: string) {
    return this.prisma.post.findMany({
      where: {
        deletedAt: null,
        published: true,
        monetizationEnabled: true,
        OR: [
          { media: { has: url } },
          { media: { has: path } },
          {
            longPost: {
              content: {
                some: {
                  OR: [{ media: { has: url } }, { media: { has: path } }],
                },
              },
            },
          },
        ],
      },
      select: { id: true, authorId: true },
    });
  }

  /**
   * For feed rendering: file IDs to strip from playback for this viewer.
   */
  async getLockedVideoFileIdsForPostView(
    post: PostWithMedia,
    viewerUserId: string | undefined,
  ): Promise<Set<string>> {
    if (
      !post.published ||
      !post.monetizationEnabled ||
      !viewerUserId ||
      post.authorId === viewerUserId
    ) {
      return new Set();
    }

    const unlocked = await this.prisma.postUnlock.findUnique({
      where: {
        userId_postId: { userId: viewerUserId, postId: post.id },
      },
    });
    if (unlocked) {
      return new Set();
    }

    return this.getMonetizedVideoFileIdsForPost(post.id);
  }
}
