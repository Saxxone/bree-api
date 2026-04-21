import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CoinsModule } from 'src/coins/coins.module';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { UserService } from 'src/user/user.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { R2StorageService } from './r2-storage.service';
import { VideoTranscodeProcessor } from './video-transcode.processor';

@Module({
  imports: [CoinsModule, BullModule.registerQueue({ name: 'video-transcode' })],
  controllers: [FileController],
  providers: [
    FileService,
    UserService,
    PrismaService,
    R2StorageService,
    VideoTranscodeProcessor,
  ],
  exports: [FileService],
})
export class FileModule {}
