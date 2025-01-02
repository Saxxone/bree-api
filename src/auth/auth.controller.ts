import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInDto } from './dto/sign-in.dto';
import { AuthGuard, Public } from './auth.guard';
import { UserService } from 'src/user/user.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Public()
  @Post('login/google')
  async googleLogin(@Body('token') token: string) {
    return await this.authService.signInGoogle(token);
  }

  @HttpCode(HttpStatus.OK)
  @Public()
  @Post('signup/google')
  async googleSignup(@Body('token') token: string) {
    return await this.authService.signUpGoogle(token);
  }

  @HttpCode(HttpStatus.OK)
  @Public()
  @Post('login')
  async signIn(@Body() signInDto: SignInDto) {
    return await this.authService.signIn(signInDto.email, signInDto.password);
  }

  @HttpCode(HttpStatus.OK)
  @Public()
  @Post('refresh')
  async refresh(@Body() signInDto: SignInDto) {
    // return await this.authService.generateRefreshToken(
    //   signInDto.email,
    //   signInDto.password,
    // );
  }

  @HttpCode(HttpStatus.OK)
  @Public()
  @Post('logout')
  async signOut(@Body() signInDto: SignInDto) {
    return await this.authService.signOut(signInDto.email, signInDto.password);
  }

  @UseGuards(AuthGuard)
  @Get('profile')
  async getProfile(@Body('id') id: string) {
    return await this.userService.findUser(id);
  }
}
