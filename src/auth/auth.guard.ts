import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  SetMetadata,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { Request } from 'express';
import { Reflector } from '@nestjs/core/services/reflector.service';
import { AuthService } from 'src/auth/auth.service';
import { User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ModuleRef } from '@nestjs/core';

interface JwtPayload {
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
      await this.verifyAccessToken(token, request, isPublic);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  private async verifyAccessToken(
    token: string,
    request: Request,
    is_public: boolean,
  ) {
    try {
      const payload: JwtPayload = await this.jwtService.verifyAsync(token, {
        secret: jwtConstants.secret,
      });

      const existing_token = await this.prisma.authToken.findUnique({
        where: { token },
      });

      if (!existing_token || existing_token.userId !== payload.userId) {
        throw new UnauthorizedException('Invalid token');
      }

      request['user'] = payload;
    } catch (error) {
      if (!is_public) {
        try {
          const refresh_token_payload: JwtPayload =
            await this.jwtService.verifyAsync(token, {
              secret: jwtConstants.refreshSecret,
            });

          const refreshToken = await this.prisma.authToken.findUnique({
            where: {
              userId_isRefreshToken: {
                userId: refresh_token_payload.userId,
                isRefreshToken: true,
              },
            },
          });

          if (!refreshToken || refreshToken.token !== token) {
            throw new UnauthorizedException('Invalid refresh token.');
          }

          const new_access_token = await this.authService.signToken({
            id: refresh_token_payload.userId,
            email: refresh_token_payload.sub,
            username: refresh_token_payload.username,
          } as User);

          const access_token_expires_at = new Date(Date.now() + 15 * 60 * 1000);
          await this.prisma.authToken.upsert({
            where: {
              userId_isRefreshToken: {
                userId: refresh_token_payload.userId,
                isRefreshToken: false,
              },
            },
            create: {
              token: new_access_token,
              userId: refresh_token_payload.userId,
              expiresAt: access_token_expires_at,
              isRefreshToken: false,
            },
            update: {
              token: new_access_token,
              expiresAt: access_token_expires_at,
            },
          });

          request['user'] = refresh_token_payload;
          request.headers.authorization = `Bearer ${new_access_token}`;
        } catch {
          throw new UnauthorizedException();
        }
      } else {
        throw error;
      }
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
