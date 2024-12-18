import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileService } from './file.service';
import { UpdateFileDto } from './dto/update-file.dto';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { compressFiles } from './file.manager';

const destination = join(__dirname, '../../../../', 'media');

fs.mkdirSync(destination, { recursive: true });

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'audio/mpeg',
  'audio/mp3',
]);

const storage = diskStorage({
  destination,
  filename: (req, file, cb) => {
    const name = file.originalname.split('.')[0];
    const extension = extname(file.originalname);
    const randomName = Array(32)
      .fill(null)
      .map(() => Math.round(Math.random() * 16).toString(16))
      .join('');
    cb(null, `${name}-${randomName}${extension}`);
  },
});

@Controller('file')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @UseInterceptors(
    AnyFilesInterceptor({
      storage: storage,
      limits: {
        fileSize: 1024 * 1024 * 20, // 20MB
        files: 4,
      },
      fileFilter: (req, file, cb) => {
        if (!allowedMimeTypes.has(file.mimetype)) {
          return cb(
            new BadRequestException(
              `Unsupported file type. Allowed types are: ${Array.from(
                allowedMimeTypes,
              ).join(', ')}`,
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  @Post('upload')
  async uploadFile(@Request() req: any) {
    let files: Array<Express.Multer.File> = [];
    let compressed_fiiles: Array<Express.Multer.File> = [];

    if (req.files) {
      files = req.files;
    } else if (req.body?._parts) {
      const parts = req.body._parts;
      for (const part of parts) {
        if (Array.isArray(part) && part[0] === 'app_files') {
          const multer_file = {
            fieldname: 'app_files',
            originalname: part[1].fileName,
            encoding: '7bit',
            mimetype: part[1].mimeType,
            size: part[1].fileSize,
            destination: destination,
            filename: part[1].fileName,
            path: part[1].uri,
          } as Express.Multer.File;

          files.push(multer_file);
        }
      }
    }
    if (files.length === 0) {
      throw new BadRequestException('No files found.');
    }

    compressed_fiiles = await compressFiles(files);

    return await this.fileService.create(compressed_fiiles, req.user.sub);
  }

  @Get()
  findAll() {
    return this.fileService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.fileService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateFileDto: UpdateFileDto) {
    return this.fileService.update(id, updateFileDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.fileService.remove(id);
  }
}
