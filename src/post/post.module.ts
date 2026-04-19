import { Module } from '@nestjs/common';
import { CoinsModule } from 'src/coins/coins.module';
import { FileService } from 'src/file/file.service';
import { NotificationModule } from 'src/notification/notification.module';
import { PrismaService } from '../prisma/prisma.service';
import { UserModule } from '../user/user.module';
import { PostController } from './post.controller';
import { PostService } from './post.service';

@Module({
  imports: [CoinsModule, UserModule, NotificationModule],
  controllers: [PostController],
  providers: [PostService, FileService, PrismaService],
  exports: [PostService],
})
export class PostModule {}
