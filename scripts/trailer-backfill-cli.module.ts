import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../src/prisma/prisma.module';
import { FileService } from '../src/file/file.service';
import { UserService } from '../src/user/user.service';

/**
 * Minimal DI graph for {@link FileService.runTrailerBackfillJob} without Bull,
 * HTTP, or the full {@link AppModule}.
 */
@Module({
  imports: [ConfigModule.forRoot(), PrismaModule],
  providers: [UserService, FileService],
})
export class TrailerBackfillCliModule {}
