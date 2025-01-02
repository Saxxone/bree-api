import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Status, File as FileModel } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs/promises';
import { join } from 'path';
import { UpdateFileDto } from './dto/update-file.dto';

@Injectable()
export class FileService {
  constructor(
    private readonly userService: UserService,
    private readonly prisma: PrismaService,
  ) {}

  private readonly logger = new Logger();

  @Cron(CronExpression.EVERY_DAY_AT_11PM)
  async handleCron() {
    this.logger.log('remove orphaned files every day at 11pm');

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setDate(twentyFourHoursAgo.getDate() - 1);

    const pendingFiles = await this.prisma.file.findMany({
      where: {
        status: Status.PENDING,
        createdAt: {
          lt: twentyFourHoursAgo,
        },
      },
    });
    await this.deleteFilesAndRecords(pendingFiles);
  }

  private async deleteFilesAndRecords(files: Array<FileModel>) {
    for (const file of files) {
      try {
        await fs.unlink(file.path);
        console.log(`File deleted from storage: ${file.path}`);

        // 2. Delete (or update) the database record
        await this.prisma.file.update({
          where: { id: file.id, status: Status.PENDING },
          data: { status: Status.DELETED },
        });
      } catch (error) {
        console.error(`Error deleting file ${file.path}:`, error);
      }
    }
  }

  async create(
    files: Array<Express.Multer.File>,
    email: string,
  ): Promise<string[]> {
    const user = await this.userService.findUser(email);
    const savedFiles: string[] = [];
    const media_base_url = process.env.FILE_BASE_URL;

    for (const file of files) {
      const savedFile = await this.prisma.file.create({
        data: {
          filename: file.filename,
          originalname: file.originalname,
          path: file.path,
          url: join(media_base_url, file.filename),
          mimetype: file.mimetype,
          size: file.size,
          status: Status.PENDING,
          type: file.mimetype.split('/')[0],
          owner: {
            connect: { id: user.id },
          },
        } as Prisma.FileCreateInput,
      });
      savedFiles.push(savedFile.id);
    }

    return savedFiles;
  }

  async getFilesUrls(
    fileIds: string[] | Prisma.PostCreatemediaInput[],
  ): Promise<{ url: string; type: string }[]> {
    return await Promise.all(
      fileIds.map(async (fileId) => {
        const file = await this.prisma.file.findUnique({
          where: {
            id: fileId,
            status: { in: [Status.PENDING, Status.UPLOADED] },
          },
        });

        if (!file) {
          throw new NotFoundException('File not found');
        }

        return { url: file.url, type: file.type };
      }),
    );
  }

  async markFileAsUploaded(fileIds: string[]) {
    return Promise.all(
      fileIds.map(async (fileId) => {
        const file = await this.prisma.file.update({
          where: { id: fileId },
          data: { status: Status.UPLOADED },
        });

        if (!file) {
          throw new NotFoundException('File not found');
        }

        return file.status;
      }),
    );
  }

  findAll() {
    return `This action returns all file`;
  }

  findOne(id: string) {
    return `This action returns a #${id} file`;
  }

  update(id: string, updateFileDto: UpdateFileDto) {
    return `This action updates a #${id} file ${updateFileDto}`;
  }

  remove(id: string) {
    return `This action removes a #${id} file`;
  }
}
