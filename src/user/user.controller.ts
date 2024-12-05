import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Put,
  Delete,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User, User as UserModel } from '@prisma/client';
import { Public } from 'src/auth/auth.guard';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Public()
  @Post('register')
  async signupUser(
    @Body()
    userData: CreateUserDto,
  ): Promise<UserModel> {
    return this.userService.createUser(userData);
  }

  @Get('/:id')
  async getUserById(@Param('id') id: string): Promise<UserModel> {
    return this.userService.findUser(id);
  }

  @Post('/search')
  async getFilteredUsers(
    @Query('q') searchString: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ): Promise<UserModel[]> {
    console.log('SEARCH:::', searchString);
    return this.userService.getMultipleUsers({
      skip: Number(skip) || 0,
      take: Number(take) || 10,
      orderBy: {
        createdAt: 'desc',
      },
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

  @Put('update/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() data: Partial<User>,
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
