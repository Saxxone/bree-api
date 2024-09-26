import { Module } from '@nestjs/common';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { PrismaService } from '../prisma.service';
import { FileService } from 'src/file/file.service';
import { UserService } from 'src/user/user.service';

@Module({
  controllers: [PostController],
  providers: [PostService, FileService, UserService, PrismaService],
})
export class PostModule {}
