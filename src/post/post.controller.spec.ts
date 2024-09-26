import { Test, TestingModule } from '@nestjs/testing';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { PrismaService } from '../prisma.service';


describe('PostController', () => {
  let postController: PostController;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostController],
      providers: [PostService , PrismaService],
    }).compile();

    postController = module.get<PostController>(PostController);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('root', () => {
    it('post controller should be defined', () => {
      expect(postController).toBeDefined();
    });

    it('prisma service should be defined', () => {
      expect(prismaService).toBeDefined();
    });
  });
});
