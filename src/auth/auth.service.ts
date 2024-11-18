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
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async signIn(email: string, pass: string): Promise<Partial<AuthUser>> {
    const user = await this.userService.findUser(email);

    if (!user) {
      throw new UnauthorizedException();
    }

    const isPasswordValid = await bcrypt.compare(pass, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException();
    }

    const { password, ...result } = user;

    const payload = { sub: user.email, username: user.username };

    return {
      ...result,
      access_token: await this.jwtService.signAsync(payload, {
        secret: jwtConstants.secret,
      }),
    };
  }

  async signOut(email: string, pass: string): Promise<any> {
    const user = await this.userService.findUser(email);

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

    const user = await this.userService.findUser(payload.email);

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
      const { password, ...result } = user;

      const data = { sub: user.email, username: user.username };

      return {
        ...result,
        access_token: await this.jwtService.signAsync(data, {
          secret: jwtConstants.secret,
        }),
      };
    }
  }

  async signUpGoogle(token: string): Promise<Partial<AuthUser>> {
    const payload: GoogleAuthUser = await this.jwtService.decode(token);

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

      const u: CreateFedUserDto = {
        name: payload.name,
        username: payload.email,
        email: payload.email,
        img: url,
      };

      const new_user = await this.userService.createFedUser(u);
      const { password, ...result } = new_user;

      const data = { sub: new_user.email, username: new_user.username };

      return {
        ...result,
        access_token: await this.jwtService.signAsync(data, {
          secret: jwtConstants.secret,
        }),
      };
    } catch (error) {
      const default_img = process.env.DEFAULT_PROFILE_IMG;
      const u: CreateFedUserDto = {
        name: payload.name,
        username: payload.email,
        email: payload.email,
        img: default_img,
      };

      const new_user = await this.userService.createFedUser(u);
      const { password, ...result } = new_user;

      const data = { sub: new_user.email, username: new_user.username };

      return {
        ...result,
        access_token: await this.jwtService.signAsync(data, {
          secret: jwtConstants.secret,
        }),
      };
    }
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
        const updatedUser = await this.userService.updateUser({
          where: { id: user.id },
          data: { img: url },
        });

        const { password, ...result } = updatedUser;

        const data = { sub: updatedUser.email, username: updatedUser.username };

        return {
          ...result,
          access_token: await this.jwtService.signAsync(data, {
            secret: jwtConstants.secret,
          }),
        };
      } catch (error) {
        console.error('Error downloading or saving image:', error);
        const { password, ...result } = user;
        const data = { sub: user.email, username: user.username };
        return {
          ...result,
          access_token: await this.jwtService.signAsync(data, {
            secret: jwtConstants.secret,
          }),
        };
      }
    }
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
    return new Promise((resolve, reject) => {
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
  }
}
