import { Module } from '@nestjs/common';
import { CoinsModule } from 'src/coins/coins.module';
import { FileModule } from 'src/file/file.module';
import { NotificationModule } from 'src/notification/notification.module';
import { PrismaService } from '../prisma/prisma.service';
import { UserModule } from '../user/user.module';
import { PostController } from './post.controller';
import { PostService } from './post.service';

@Module({
  imports: [CoinsModule, UserModule, NotificationModule, FileModule],
  controllers: [PostController],
  providers: [PostService, PrismaService],
  exports: [PostService],
})
export class PostModule {}
