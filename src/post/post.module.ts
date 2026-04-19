import { Module } from '@nestjs/common';
import { CoinsModule } from 'src/coins/coins.module';
import { FileService } from 'src/file/file.service';
import { NotificationService } from 'src/notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserModule } from '../user/user.module';
import { PostController } from './post.controller';
import { PostService } from './post.service';

@Module({
  imports: [CoinsModule, UserModule],
  controllers: [PostController],
  providers: [
    PostService,
    FileService,
    PrismaService,
    NotificationService,
  ],
  exports: [PostService],
})
export class PostModule {}
