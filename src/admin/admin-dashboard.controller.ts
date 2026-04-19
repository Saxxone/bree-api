import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SuperAdminGuard } from './super-admin.guard';

@Controller('admin/dashboard')
@UseGuards(SuperAdminGuard)
export class AdminDashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('summary')
  async summary() {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      usersTotal,
      postsTotal,
      postsMonetized,
      filesByStatus,
      ledger24h,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.post.count({ where: { deletedAt: null } }),
      this.prisma.post.count({
        where: { deletedAt: null, monetizationEnabled: true },
      }),
      this.prisma.file.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.coinLedgerEntry.aggregate({
        where: { createdAt: { gte: since24h } },
        _sum: { amountMinor: true },
        _count: { id: true },
      }),
    ]);

    return {
      usersTotal,
      postsTotal,
      postsMonetized,
      filesByStatus: Object.fromEntries(
        filesByStatus.map((r) => [r.status, r._count.id]),
      ),
      ledgerLast24h: {
        entryCount: ledger24h._count.id,
        netAmountMinorSum: ledger24h._sum.amountMinor ?? 0,
      },
    };
  }
}
