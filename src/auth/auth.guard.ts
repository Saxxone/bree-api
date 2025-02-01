import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Reflector } from '@nestjs/core/services/reflector.service';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthService } from 'src/auth/auth.service';
import { PrismaService } from 'src/prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  username: string;
  userId: string;
}

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private prisma: PrismaService;
  private authService: AuthService;

  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      if (!this.prisma) {
        this.prisma = this.moduleRef.get(PrismaService, { strict: false });
      }
      if (!this.authService) {
        this.authService = this.moduleRef.get(AuthService, { strict: false });
      }

      const isPublic = this.reflector.getAllAndOverride<boolean>(
        IS_PUBLIC_KEY,
        [context.getHandler(), context.getClass()],
      );

      const request = context.switchToHttp().getRequest();
      const token = this.extractTokenFromHeader(request);

      if (token) await this.verifyAndProcessToken(token, request, isPublic);

      if (isPublic) return true;

      if (!token) {
        throw new UnauthorizedException();
      }
      return true;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  private async verifyAndProcessToken(
    token: string,
    request: Request,
    isPublic: boolean,
  ): Promise<void> {
    try {
      await this.authService.verifyAccessToken(token, request, isPublic);
    } catch (error) {
      throw new UnauthorizedException(error);
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (
      token &&
      token !== '' &&
      token !== 'undefined' &&
      token !== 'null' &&
      type === 'Bearer'
    ) {
      return token;
    } else {
      return undefined;
    }
  }
}
