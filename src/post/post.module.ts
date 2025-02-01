import { Module } from '@nestjs/common';
import { FileService } from 'src/file/file.service';
import { NotificationService } from 'src/notification/notification.service';
import { UserService } from 'src/user/user.service';
import { PrismaService } from '../prisma/prisma.service';
import { PostController } from './post.controller';
import { PostService } from './post.service';

@Module({
  controllers: [PostController],
  providers: [
    PostService,
    FileService,
    UserService,
    PrismaService,
    NotificationService,
  ],
})
export class PostModule {}
