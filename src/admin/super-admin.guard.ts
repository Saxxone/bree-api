import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.userId as string | undefined;
    if (!userId) {
      throw new ForbiddenException();
    }

    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (row?.role !== UserRole.SUPERADMIN) {
      throw new ForbiddenException('Superadmin access required');
    }

    return true;
  }
}
