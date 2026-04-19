import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { CoinsModule } from 'src/coins/coins.module';
import { PostModule } from 'src/post/post.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminCoinsController } from './admin-coins.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminFilesController } from './admin-files.controller';
import { AdminPostsController } from './admin-posts.controller';
import { AdminUsersController } from './admin-users.controller';
import { SuperAdminGuard } from './super-admin.guard';

@Module({
  imports: [AuthModule, PostModule, CoinsModule],
  controllers: [
    AdminAuthController,
    AdminDashboardController,
    AdminUsersController,
    AdminPostsController,
    AdminFilesController,
    AdminCoinsController,
  ],
  providers: [SuperAdminGuard],
})
export class AdminModule {}
