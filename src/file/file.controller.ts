import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Head,
  NotFoundException,
  Param,
  Patch,
  Post,
  Request,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Request as ExpressRequest, Response } from 'express';
import { Public } from 'src/auth/auth.guard';
import { Status } from '@prisma/client';
import { UpdateFileDto } from './dto/update-file.dto';
import { compressFiles } from './file.manager';
import { FileService } from './file.service';
import { ensureMediaStorageDir, getMediaStorageDir } from './media-storage';

ensureMediaStorageDir();

function parseMaxSizeMb(): number {
  const raw = parseInt(process.env.FILE_MAX_SIZE_MB ?? '500', 10);
  if (!Number.isFinite(raw)) return 500;
  return Math.min(Math.max(1, raw), 1024);
}

function parseMaxFiles(): number {
  const raw = parseInt(process.env.FILE_MAX_FILES ?? '4', 10);
  if (!Number.isFinite(raw)) return 4;
  return Math.min(Math.max(1, raw), 20);
}

const FILE_MAX_BYTES = parseMaxSizeMb() * 1024 * 1024;
const FILE_MAX_FILES = parseMaxFiles();

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/heic',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/mp3',
]);

const storage = diskStorage({
  destination: (_req, _file, cb) => {
    ensureMediaStorageDir();
    cb(null, getMediaStorageDir());
  },
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
        fileSize: FILE_MAX_BYTES,
        files: FILE_MAX_FILES,
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
  async uploadFile(
    @Request() req: ExpressRequest & { user?: { sub: string } },
  ) {
    let files: Array<Express.Multer.File> = [];
    let compressed_fiiles: Array<Express.Multer.File> = [];

    if (req.files) {
      files = req.files as Array<Express.Multer.File>;
    }

    if (files.length === 0) throw new BadRequestException('No files found.');

    compressed_fiiles = await compressFiles(files);

    return await this.fileService.create(compressed_fiiles, req.user!.sub);
  }

  @Get()
  findAll() {
    return this.fileService.findAll();
  }

  @Head('stream/:id')
  async streamFileHead(
    @Param('id') id: string,
    @Request() req: ExpressRequest,
    @Res({ passthrough: false }) res: Response,
  ) {
    await this.streamMedia(id, req, res, true);
  }

  @Get('stream/:id')
  async streamFileGet(
    @Param('id') id: string,
    @Request() req: ExpressRequest,
    @Res({ passthrough: false }) res: Response,
  ) {
    await this.streamMedia(id, req, res, false);
  }

  @Public()
  @Head('media/:filename')
  async mediaHead(
    @Param('filename') filename: string,
    @Request() req: ExpressRequest,
    @Res({ passthrough: false }) res: Response,
  ) {
    await this.serveMediaByFilename(filename, req, res, true);
  }

  @Public()
  @Get('media/:filename')
  async mediaGet(
    @Param('filename') filename: string,
    @Request() req: ExpressRequest,
    @Res({ passthrough: false }) res: Response,
  ) {
    await this.serveMediaByFilename(filename, req, res, false);
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

  private async streamMedia(
    id: string,
    req: ExpressRequest,
    res: Response,
    headOnly: boolean,
  ) {
    const user = (req as ExpressRequest & { user?: { userId?: string } }).user;
    const file = await this.fileService.findForStream(id);
    this.fileService.assertStreamAccess(file, user);
    await this.pipeRangedFile(file.path, file.mimetype, req, res, headOnly);
  }

  private async serveMediaByFilename(
    filename: string,
    req: ExpressRequest,
    res: Response,
    headOnly: boolean,
  ) {
    const user = (req as ExpressRequest & { user?: { userId?: string } }).user;
    const file = await this.fileService.findForStreamByFilename(filename);
    if (file.status !== Status.UPLOADED) {
      this.fileService.assertStreamAccess(file, user);
    }
    await this.pipeRangedFile(file.path, file.mimetype, req, res, headOnly);
  }

  private async pipeRangedFile(
    absolutePath: string,
    mimetype: string | null,
    req: ExpressRequest,
    res: Response,
    headOnly: boolean,
  ) {
    let fileSize: number;
    try {
      const stats = await fs.promises.stat(absolutePath);
      fileSize = stats.size;
    } catch {
      throw new NotFoundException('File not found');
    }

    const contentType = mimetype || 'application/octet-stream';
    const range = req.headers.range;

    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
        return;
      }
      const start = parseInt(match[1], 10);
      let end = match[2] !== '' ? parseInt(match[2], 10) : fileSize - 1;
      if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        start >= fileSize ||
        start > end
      ) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
        return;
      }
      end = Math.min(end, fileSize - 1);
      const chunkSize = end - start + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunkSize);
      res.setHeader('Content-Type', contentType);
      if (headOnly) {
        res.end();
        return;
      }
      const stream = fs.createReadStream(absolutePath, { start, end });
      stream.on('error', () => {
        if (!res.headersSent) res.status(500).end();
        else res.destroy();
      });
      stream.pipe(res);
    } else {
      res.status(200);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Content-Type', contentType);
      if (headOnly) {
        res.end();
        return;
      }
      const stream = fs.createReadStream(absolutePath);
      stream.on('error', () => {
        if (!res.headersSent) res.status(500).end();
        else res.destroy();
      });
      stream.pipe(res);
    }
  }
}
