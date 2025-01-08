import {
  Injectable,
  UnauthorizedException,
  NotAcceptableException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { GoogleAuthUser, AuthUser } from './dto/sign-in.dto';
import { User } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as https from 'https';
import { join } from 'path';
import * as fs from 'fs';
import { CreateFedUserDto } from 'src/user/dto/create-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from './auth.guard';
import { Request } from 'express';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async signIn(email: string, pass: string): Promise<Partial<AuthUser>> {
    console.log(email, pass);
    const user = await this.userService.findUser(email, { withPassword: true });

    if (!user) {
      throw new UnauthorizedException();
    }

    const isPasswordValid = await bcrypt.compare(pass, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException();
    }

    if (user.password) delete user.password;

    return {
      ...user,
      ...(await this.generateTokens(user)),
    };
  }

  async signOut(email: string, pass: string): Promise<any> {
    const user = await this.userService.findUser(email, { withPassword: true });

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

  async signInGoogle(token: string): Promise<Partial<AuthUser>> {
    const payload: GoogleAuthUser = await this.jwtService.decode(token);

    const user = await this.userService.findUser(payload.email, {
      withPassword: true,
    });

    const client_id = process.env.GOOGLE_AUTH_CLIENT_ID;
    const default_img = process.env.DEFAULT_PROFILE_IMG;

    if (!user) {
      throw new UnauthorizedException();
    }

    if (client_id !== payload.aud) {
      throw new UnauthorizedException();
    }

    if (user.img === default_img) {
      return await this.updateUserProfile(user, payload, default_img);
    } else {
      if (user.password) delete user.password;

      return {
        ...user,
        ...(await this.generateTokens(user)),
      };
    }
  }

  async signUpGoogle(token: string): Promise<Partial<AuthUser>> {
    const payload: GoogleAuthUser = await this.jwtService.decode(token);

    let img_url = process.env.DEFAULT_PROFILE_IMG;

    const user = await this.prisma.user.findFirst({
      where: {
        email: payload.email,
      },
    });

    const client_id = process.env.GOOGLE_AUTH_CLIENT_ID;

    if (user) {
      throw new NotAcceptableException();
    }

    if (client_id !== payload.aud) {
      throw new UnauthorizedException();
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
      img: img_url,
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

        if (user.password) delete user.password;

        return {
          ...user,
          ...(await this.generateTokens(user)),
        };
      }
    }
  }

  async refresh(refreshToken: string): Promise<{ access_token: string }> {
    try {
      const refreshTokenPayload = await this.verifyRefreshToken(refreshToken);

      const newAccessToken =
        await this.generateAccessToken(refreshTokenPayload);
      return { access_token: newAccessToken };
    } catch (error) {
      throw new UnauthorizedException(error);
    }
  }

  async generateAccessToken(payload: JwtPayload): Promise<string> {
    const newAccessToken = await this.signToken({
      id: payload.userId,
      email: payload.sub,
      username: payload.username,
    } as User);

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

          const new_access_token = await this.signToken({
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
          throw new UnauthorizedException(error);
        }
      } else {
        throw new UnauthorizedException(error);
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
    };
    return this.jwtService.signAsync(payload, {
      secret: jwtConstants.secret,
      expiresIn: '15m',
    });
  }

  private async generateRefreshToken(user: User): Promise<string> {
    const payload = {
      sub: user.email,
      username: user.username,
      userId: user.id,
    };
    return this.jwtService.signAsync(payload, {
      secret: jwtConstants.refreshSecret,
      expiresIn: '7d',
    });
  }

  private async saveToken(
    userId: string,
    token: string,
    isRefreshToken: boolean,
  ): Promise<void> {
    const expiresAt = new Date(
      Date.now() + (isRefreshToken ? 7 : 15) * 60 * 1000,
    );

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

  private createImgPath() {
    const img_name = uuidv4() + '.jpg';
    const destination = join(__dirname, '../../../../', 'media');
    const media_base_url = process.env.FILE_BASE_URL;
    fs.mkdirSync(destination, { recursive: true });
    const img_path = `${media_base_url}${img_name}`;
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
