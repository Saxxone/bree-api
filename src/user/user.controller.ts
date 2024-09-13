import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Put,
  Delete,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User, User as UserModel } from '@prisma/client';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('user')
  async signupUser(
    @Body()
    userData: {
      name: string;
      email: string;
      password: string;
      username: string;
      img: string;
    },
  ): Promise<UserModel> {
    return this.userService.createUser(userData);
  }

  @Get('/:id')
  async getPostById(@Param('id') id: string): Promise<UserModel> {
    return this.userService.findUser({ id: String(id) });
  }

  @Get('filtered-users/:searchString')
  async getFilteredPosts(
    @Param('searchString') searchString: string,
  ): Promise<UserModel[]> {
    return this.userService.getMultipleUsers({
      where: {
        OR: [
          {
            name: { contains: searchString },
          },
          {
            username: { contains: searchString },
          },
        ],
      },
    });
  }

  @Put('user/:id')
  async updateUser(
    @Param('id') id: string,
    data: Partial<User>,
  ): Promise<UserModel> {
    return this.userService.updateUser({
      where: { id: String(id) },
      data,
    });
  }

  @Delete('post/:id')
  async deletePost(@Param('id') id: string): Promise<UserModel> {
    return this.userService.deleteUser({ id: String(id) });
  }
}
