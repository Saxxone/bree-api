import { Module } from '@nestjs/common';
import { CoinsModule } from 'src/coins/coins.module';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { UserService } from 'src/user/user.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports: [CoinsModule],
  controllers: [FileController],
  providers: [FileService, UserService, PrismaService],
})
export class FileModule {}
