import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { AuthService } from 'src/auth/auth.service';
import { Public } from 'src/auth/auth.guard';
import { SignInDto } from 'src/auth/dto/sign-in.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { SuperAdminGuard } from './super-admin.guard';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() body: SignInDto) {
    return this.authService.signInSuperAdmin(
      body.usernameOrEmail,
      body.password,
    );
  }

  @UseGuards(SuperAdminGuard)
  @Get('me')
  async me(@Request() req: { user: { userId: string } }): Promise<
    Omit<User, 'password'>
  > {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: req.user.userId },
    });
    if (user.password) {
      delete (user as { password?: string }).password;
    }
    return user;
  }
}
