import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Put,
  Delete,
  Query,
  Request,
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
    @Query('q') search_string: string,
    @Request() req: any,
    @Query('with_pk') with_pk?: boolean,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ): Promise<Partial<UserModel>[]> {
    return this.userService.getMultipleUsers(
      {
        skip: Number(skip) || 0,
        take: Number(take) || 10,
        orderBy: {
          createdAt: 'desc',
        },
        where: {
          OR: [
            {
              name: { contains: encodeURIComponent(search_string.trim()) },
            },
            {
              username: { contains: encodeURIComponent(search_string.trim()) },
            },
          ],
        },
      },
      req.user.sub,
      with_pk,
    );
  }

  @Post('/global-search')
  async searchUsersAndPosts(
    @Query() query: Record<string, any>,
    @Request() req: any,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ): Promise<Partial<UserModel>[]> {
    return this.userService.getMultipleUsers(
      {
        skip: Number(skip) || 0,
        take: Number(take) || 10,
        orderBy: {
          createdAt: 'desc',
        },
        where: {
          OR: [
            // {
            //   name: { search: search_string },
            // },
            // {
            //   username: { search: search_string },
            // },
          ],
        },
      },
      req.user.sub,
      false,
    );
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
