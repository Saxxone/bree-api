import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';



@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService
  ) {}


  async signIn(email: string, pass: string): Promise<any> {
    const user = await this.userService.findUser(email);

    if (!user) {
      throw new UnauthorizedException();
    }

    const isPasswordValid = await bcrypt.compare(user?.password, pass);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException();
    }

    const { password, ...result } = user;

    const payload = { sub: user.email, username: user.username };
    
    return {
      ...result,
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}
