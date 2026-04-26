import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  NotAcceptableException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { GoogleAuthUser, AuthUser } from './dto/sign-in.dto';
import { User, UserRole } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as https from 'https';
import { join } from 'path';
import { getMediaStorageDir, resolveFileBaseUrl } from 'src/file/media-storage';
import * as fs from 'fs';
import { CreateFedUserDto } from 'src/user/dto/create-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from './auth.guard';
import { Request } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

/** JWT signing secrets from env (also imported by AuthModule for JwtModule registration). */
export const jwtConstants = {
  secret: process.env.JWT_SECRET || '',
  refreshSecret: process.env.JWT_REFRESH_SECRET || '',
};

const EXPIRY = '200d';

const googleOauthPublicKeys = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
);

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async signIn(
    usernameOrEmail: string,
    pass: string,
  ): Promise<Partial<AuthUser>> {
    const user = await this.userService.findUser(usernameOrEmail, {
      withPassword: true,
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    const isPasswordValid = await bcrypt.compare(pass, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException();
    }

    const fullUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    const tokens = await this.generateTokens(fullUser);
    if (fullUser.password) {
      delete (fullUser as { password?: string }).password;
    }
    return { ...fullUser, ...tokens };
  }

  async signInSuperAdmin(
    usernameOrEmail: string,
    pass: string,
  ): Promise<
    Partial<AuthUser> & { access_token: string; refresh_token: string }
  > {
    const row = await this.userService.findUser(usernameOrEmail, {
      withPassword: true,
    });

    if (!row.password) {
      throw new ForbiddenException(
        'Superadmin login requires a password-based account',
      );
    }

    const isPasswordValid = await bcrypt.compare(pass, row.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException();
    }

    if (row.role !== UserRole.SUPERADMIN) {
      throw new ForbiddenException('Superadmin access required');
    }

    const fullUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: row.id },
    });
    const tokens = await this.generateTokens(fullUser);
    if (fullUser.password) {
      delete (fullUser as { password?: string }).password;
    }
    return { ...fullUser, ...tokens };
  }

  async signOut(usernameOrEmail: string, pass: string): Promise<any> {
    const user = await this.userService.findUser(usernameOrEmail, {
      withPassword: true,
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    const isPasswordValid = await bcrypt.compare(pass, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException();
    }

    return {
      message: 'Logged out successfully',
    };
  }

  /**
   * Verifies a Google **ID token** (not an access token) via Google JWKS.
   */
  private async verifyGoogleIdToken(
    idToken: string,
  ): Promise<JWTPayload & { email?: string; name?: string; picture?: string }> {
    const clientId = process.env.GOOGLE_AUTH_CLIENT_ID;
    if (!clientId) {
      throw new UnauthorizedException();
    }
    try {
      const { payload } = await jwtVerify(idToken, googleOauthPublicKeys, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: clientId,
      });
      return payload as JWTPayload & {
        email?: string;
        name?: string;
        picture?: string;
      };
    } catch {
      throw new UnauthorizedException();
    }
  }

  private googlePayloadToUserShape(
    p: JWTPayload & { email?: string; name?: string; picture?: string },
  ): GoogleAuthUser {
    return {
      iss: (p.iss as string) ?? '',
      azp: (p.azp as string) ?? '',
      aud: (p.aud as string) ?? '',
      sub: (p.sub as string) ?? '',
      email: p.email as string,
      email_verified: Boolean(p['email_verified']),
      nbf: Number(p['nbf']) || 0,
      name: (p.name as string) ?? '',
      picture: (p.picture as string) ?? '',
      given_name: (p['given_name'] as string) ?? '',
      family_name: (p['family_name'] as string) ?? '',
      iat: Number(p.iat) || 0,
      exp: Number(p.exp) || 0,
      jti: (p.jti as string) ?? '',
    };
  }

  /**
   * Validates a session **access** JWT present in `AuthToken` (same as HTTP `AuthGuard`).
   * Not used for refresh-token-as–Bearer. Used by Socket.IO.
   */
  async validateAccessTokenString(
    token: string | undefined | null,
  ): Promise<JwtPayload | null> {
    if (!token || token === 'null' || token === 'undefined') {
      return null;
    }
    try {
      const payload = (await this.jwtService.verifyAsync(token, {
        secret: jwtConstants.secret,
      })) as JwtPayload;
      const row = await this.prisma.authToken.findUnique({ where: { token } });
      if (!row || row.userId !== payload.userId) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  async signInGoogle(token: string): Promise<Partial<AuthUser>> {
    const p = await this.verifyGoogleIdToken(token);
    if (!p.email) {
      throw new UnauthorizedException();
    }
    const payload = this.googlePayloadToUserShape(p);

    const user = await this.userService.findUser(payload.email, {
      withPassword: true,
    });

    const default_img = process.env.DEFAULT_PROFILE_IMG;

    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.img === default_img) {
      return await this.updateUserProfile(user, payload, default_img!);
    }
    const fullUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    const tokens = await this.generateTokens(fullUser);
    if (fullUser.password) {
      delete (fullUser as { password?: string }).password;
    }
    return { ...fullUser, ...tokens };
  }

  async signUpGoogle(token: string): Promise<Partial<AuthUser>> {
    const p = await this.verifyGoogleIdToken(token);
    if (!p.email) {
      throw new UnauthorizedException();
    }
    const payload = this.googlePayloadToUserShape(p);

    let img_url = process.env.DEFAULT_PROFILE_IMG;

    const existing = await this.prisma.user.findFirst({
      where: {
        email: payload.email,
      },
    });

    if (existing) {
      throw new NotAcceptableException();
    }

    try {
      const { url, file } = this.createImgPath();
      await this.downloadImage(payload.picture, file);
      img_url = url;
    } catch (error) {
      console.error('Error downloading or saving image:', error);
    }

    const u: CreateFedUserDto = {
      name: payload.name,
      username: payload.email.split('@')[0],
      email: payload.email,
      img: img_url!,
    };

    const new_user = await this.userService.createFedUser(u);

    if (new_user.password) delete new_user.password;

    return {
      ...new_user,
      ...(await this.generateTokens(new_user)),
    };
  }

  private async updateUserProfile(
    user: User,
    payload: GoogleAuthUser,
    default_img: string,
  ): Promise<Partial<AuthUser>> {
    if (user.img === default_img) {
      try {
        const { url, file } = this.createImgPath();
        await this.downloadImage(payload.picture, file);
        const updated_user = await this.userService.updateUser({
          where: { id: user.id },
          data: { img: url },
        });

        if (updated_user.password) delete updated_user.password;

        return {
          ...updated_user,
          ...(await this.generateTokens(updated_user)),
        };
      } catch (error) {
        console.error('Error downloading or saving image:', error);

        const fullUser = await this.prisma.user.findUniqueOrThrow({
          where: { id: user.id },
        });
        const tokens = await this.generateTokens(fullUser);
        if (fullUser.password) {
          delete (fullUser as { password?: string }).password;
        }
        return { ...fullUser, ...tokens };
      }
    }
  }

  async refresh(refreshToken: string): Promise<{ access_token: string }> {
    try {
      const refreshTokenPayload = await this.verifyRefreshToken(refreshToken);

      const newAccessToken =
        await this.generateAccessToken(refreshTokenPayload);
      return { access_token: newAccessToken };
    } catch {
      throw new UnauthorizedException(
        'Your session could not be refreshed. Please sign in again.',
      );
    }
  }

  async generateAccessToken(payload: JwtPayload): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.userId },
    });
    const newAccessToken = await this.signToken(user);

    await this.saveToken(payload.userId, newAccessToken, false);
    return newAccessToken;
  }

  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    const refreshTokenPayload: JwtPayload = await this.jwtService.verifyAsync(
      token,
      {
        secret: jwtConstants.refreshSecret,
      },
    );

    const storedRefreshToken = await this.prisma.authToken.findUnique({
      where: {
        userId_isRefreshToken: {
          userId: refreshTokenPayload.userId,
          isRefreshToken: true,
        },
      },
    });

    if (
      !storedRefreshToken ||
      storedRefreshToken.token !== token ||
      storedRefreshToken.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return refreshTokenPayload;
  }

  async verifyAccessToken(token: string, request: Request, is_public: boolean) {
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

      request['user'] = payload as JwtPayload;
    } catch {
      // Public routes: ignore invalid/stale Authorization (e.g. refresh POST with old Bearer).
      if (is_public) {
        return;
      }
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

        const dbUser = await this.prisma.user.findUniqueOrThrow({
          where: { id: refresh_token_payload.userId },
        });
        const new_access_token = await this.signToken(dbUser);

        const access_token_expires_at = this.expiresAtFromJwt(
          new_access_token,
          false,
        );
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

        request['user'] = {
          sub: dbUser.email,
          username: dbUser.username,
          userId: dbUser.id,
          role: dbUser.role,
        };
        request.headers.authorization = `Bearer ${new_access_token}`;
      } catch (inner) {
        if (inner instanceof UnauthorizedException) {
          throw inner;
        }
        throw new UnauthorizedException(
          'Invalid or expired session. Please sign in again.',
        );
      }
    }
  }

  async generateTokens(
    user: User,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const access_token = await this.signToken(user);
    const refresh_token = await this.generateRefreshToken(user);

    await this.saveToken(user.id, access_token, false);
    await this.saveToken(user.id, refresh_token, true);

    return { access_token, refresh_token };
  }

  async signToken(user: User): Promise<string> {
    const payload = {
      sub: user.email,
      username: user.username,
      userId: user.id,
      role: user.role,
    };
    return this.jwtService.signAsync(payload, {
      secret: jwtConstants.secret,
      expiresIn: EXPIRY,
    });
  }

  private async generateRefreshToken(user: User): Promise<string> {
    const payload = {
      sub: user.email,
      username: user.username,
      userId: user.id,
      role: user.role,
    };
    return this.jwtService.signAsync(payload, {
      secret: jwtConstants.refreshSecret,
      expiresIn: '7d',
    });
  }

  /**
   * Persist a token alongside the JWT's own `exp` claim so the DB row and the
   * JWT cannot disagree on lifetime. The previous implementation hard-coded
   * 100 minutes for refresh and 200 minutes for access while the JWTs
   * themselves were signed with `7d` and `200d` respectively, which caused
   * `verifyRefreshToken` to reject perfectly valid refresh JWTs after ~100
   * minutes and silently log mobile users out.
   */
  private async saveToken(
    userId: string,
    token: string,
    isRefreshToken: boolean,
  ): Promise<void> {
    const expiresAt = this.expiresAtFromJwt(token, isRefreshToken);

    await this.prisma.authToken.upsert({
      where: { userId_isRefreshToken: { userId, isRefreshToken } },
      update: { token, expiresAt },
      create: {
        userId,
        token,
        isRefreshToken,
        expiresAt,
      },
    });
  }

  /**
   * Decodes the JWT (without verifying — we just signed it) and returns its
   * `exp` as a Date. Falls back to a sensible default that matches the JWT
   * `signAsync` `expiresIn` if the claim is missing for any reason.
   */
  private expiresAtFromJwt(token: string, isRefreshToken: boolean): Date {
    const decoded = this.jwtService.decode(token) as
      | { exp?: number }
      | null
      | string;
    if (
      decoded &&
      typeof decoded === 'object' &&
      typeof decoded.exp === 'number'
    ) {
      return new Date(decoded.exp * 1000);
    }
    // Fallback: refresh = 7d, access = 200d (mirrors signing options).
    const fallbackMs = isRefreshToken
      ? 7 * 24 * 60 * 60 * 1000
      : 200 * 24 * 60 * 60 * 1000;
    return new Date(Date.now() + fallbackMs);
  }

  private createImgPath() {
    const img_name = uuidv4() + '.jpg';
    const destination = getMediaStorageDir();
    fs.mkdirSync(destination, { recursive: true });
    const img_path = `${resolveFileBaseUrl()}${img_name}`;
    return { url: img_path, file: join(destination, img_name) };
  }

  private async downloadImage(url: string, filepath: string): Promise<void> {
    try {
      return await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https
          .get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
              file.close();
              resolve();
            });
          })
          .on('error', (err) => {
            fs.unlink(filepath, () => reject(err));
          });
      });
    } catch (error) {
      console.error('Error downloading image:', error);
      throw error;
    }
  }
}
