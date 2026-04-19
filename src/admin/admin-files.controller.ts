import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { Status } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { SuperAdminGuard } from './super-admin.guard';

const ADMIN_FILE_STATUSES: ReadonlySet<Status> = new Set([
  Status.PENDING,
  Status.APPROVED,
  Status.REJECTED,
  Status.UPLOADED,
  Status.DELETED,
]);

class AdminPatchFileDto {
  @IsEnum(Status)
  status: Status;
}

@Controller('admin/files')
@UseGuards(SuperAdminGuard)
export class AdminFilesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query('status') status?: Status,
    @Query('mimetypePrefix') mimetypePrefix?: string,
    @Query('skip') skipRaw?: string,
    @Query('take') takeRaw?: string,
  ) {
    const skip = Math.min(parseInt(skipRaw ?? '0', 10) || 0, 100_000);
    const take = Math.min(Math.max(parseInt(takeRaw ?? '30', 10) || 30, 1), 100);

    const where: {
      status?: Status;
      mimetype?: { startsWith: string };
      deletedAt?: null;
    } = { deletedAt: null };
    if (status) where.status = status;
    if (mimetypePrefix?.trim()) {
      where.mimetype = { startsWith: mimetypePrefix.trim() };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.file.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          originalname: true,
          filename: true,
          size: true,
          type: true,
          mimetype: true,
          status: true,
          url: true,
          ownerId: true,
          videoWidth: true,
          videoHeight: true,
          videoDurationSeconds: true,
          createdAt: true,
        },
      }),
      this.prisma.file.count({ where }),
    ]);

    return { items, total, skip, take };
  }

  @Patch(':id')
  async patchStatus(@Param('id') id: string, @Body() body: AdminPatchFileDto) {
    if (!ADMIN_FILE_STATUSES.has(body.status)) {
      throw new BadRequestException('Unsupported file status for admin update');
    }
    return this.prisma.file.update({
      where: { id },
      data: { status: body.status },
      select: {
        id: true,
        status: true,
        originalname: true,
        mimetype: true,
      },
    });
  }
}
