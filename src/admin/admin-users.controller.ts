import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PrismaService } from 'src/prisma/prisma.service';
import { SuperAdminGuard } from './super-admin.guard';

class AdminPatchUserDto {
  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsString()
  name?: string;
}

@Controller('admin/users')
@UseGuards(SuperAdminGuard)
export class AdminUsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query('q') q?: string,
    @Query('skip') skipRaw?: string,
    @Query('take') takeRaw?: string,
  ) {
    const skip = Math.min(parseInt(skipRaw ?? '0', 10) || 0, 100_000);
    const take = Math.min(Math.max(parseInt(takeRaw ?? '30', 10) || 30, 1), 100);
    const where = q?.trim()
      ? {
          OR: [
            { email: { contains: q.trim(), mode: 'insensitive' as const } },
            { username: { contains: q.trim(), mode: 'insensitive' as const } },
            { name: { contains: q.trim(), mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: { ...where, deletedAt: null },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          verified: true,
          role: true,
          createdAt: true,
          deletedAt: true,
        },
      }),
      this.prisma.user.count({ where: { ...where, deletedAt: null } }),
    ]);

    return { items, total, skip, take };
  }

  @Patch(':id')
  async patch(@Param('id') id: string, @Body() body: AdminPatchUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(body.verified !== undefined && { verified: body.verified }),
        ...(body.name !== undefined && { name: body.name }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        verified: true,
        role: true,
        createdAt: true,
      },
    });
  }
}
