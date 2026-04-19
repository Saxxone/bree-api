import { Test, TestingModule } from '@nestjs/testing';
import { PostController } from './post.controller';
import { PostService } from './post.service';

jest.mock('src/auth/auth.guard', () => ({
  Public: () => () => {},
}));

describe('PostController watch history routes', () => {
  let controller: PostController;
  const postService = {
    recordWatch: jest.fn().mockResolvedValue({ recorded: true }),
    getMyWatchHistory: jest.fn().mockResolvedValue([]),
    getMyLikedVideos: jest.fn().mockResolvedValue([]),
    getMyUnlockedPosts: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostController],
      providers: [{ provide: PostService, useValue: postService }],
    }).compile();

    controller = module.get<PostController>(PostController);
    jest.clearAllMocks();
  });

  it('POST watch/:id delegates to PostService.recordWatch', async () => {
    const req = { user: { sub: 'viewer@example.com' } };
    const out = await controller.recordWatch('post-1', req);
    expect(postService.recordWatch).toHaveBeenCalledWith(
      'post-1',
      'viewer@example.com',
    );
    expect(out).toEqual({ recorded: true });
  });

  it('GET me/watch-history delegates with pagination', async () => {
    const req = { user: { sub: 'viewer@example.com' } };
    await controller.getMyWatchHistory(req, '0', '10', undefined);
    expect(postService.getMyWatchHistory).toHaveBeenCalledWith(
      'viewer@example.com',
      { skip: 0, take: 10 },
    );
  });

  it('GET me/liked-videos delegates with pagination', async () => {
    const req = { user: { sub: 'viewer@example.com' } };
    await controller.getMyLikedVideos(req, '0', '10', undefined);
    expect(postService.getMyLikedVideos).toHaveBeenCalledWith(
      'viewer@example.com',
      { skip: 0, take: 10, cursor: undefined },
    );
  });

  it('GET me/unlocked delegates with pagination', async () => {
    const req = { user: { sub: 'viewer@example.com' } };
    await controller.getMyUnlockedPosts(req, '0', '10', undefined);
    expect(postService.getMyUnlockedPosts).toHaveBeenCalledWith(
      'viewer@example.com',
      { skip: 0, take: 10 },
    );
  });
});
