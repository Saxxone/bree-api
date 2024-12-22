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

    const payload = { sub: user.email, username: user.username };

    return {
      ...user,
      access_token: await this.jwtService.signAsync(payload, {
        secret: jwtConstants.secret,
      }),
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
      const data = { sub: user.email, username: user.username };
      if (user.password) delete user.password;

      return {
        ...user,
        access_token: await this.jwtService.signAsync(data, {
          secret: jwtConstants.secret,
        }),
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

    const data = { sub: new_user.email, username: new_user.username };

    if (new_user.password) delete new_user.password;

    return {
      ...new_user,
      access_token: await this.jwtService.signAsync(data, {
        secret: jwtConstants.secret,
      }),
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

        const data = {
          sub: updated_user.email,
          username: updated_user.username,
        };

        return {
          ...updated_user,
          access_token: await this.jwtService.signAsync(data, {
            secret: jwtConstants.secret,
          }),
        };
      } catch (error) {
        console.error('Error downloading or saving image:', error);

        if (user.password) delete user.password;
        const data = { sub: user.email, username: user.username };
        return {
          ...user,
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
    try {
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
    } catch (error) {
      console.error('Error downloading image:', error);
      throw error;
    }
  }
}
