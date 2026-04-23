import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFedUserDto, CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findUser(
    usernameOrEmail: string,
    options?: {
      withPassword?: boolean;
    },
  ): Promise<User | null> {
    const searchTerm = usernameOrEmail.startsWith('@')
      ? usernameOrEmail.substring(1)
      : usernameOrEmail;

    const where = {
      OR: [
        { username: searchTerm },
        { email: usernameOrEmail },
        { id: usernameOrEmail },
      ],
    } satisfies Prisma.UserWhereInput;

    const user = options?.withPassword
      ? await this.prisma.user.findFirst({
          select: {
            password: true,
            id: true,
            email: true,
            username: true,
            img: true,
            bio: true,
            verified: true,
            role: true,
          },
          where,
        })
      : await this.prisma.user.findFirst({ where });

    if (!user) throw new NotFoundException('User not found');
    return user as User;
  }

  async getMultipleUsers(
    params: {
      skip?: number;
      take?: number;
      cursor?: Prisma.UserWhereUniqueInput;
      where?: Prisma.UserWhereInput;
      orderBy?: Prisma.UserOrderByWithRelationInput;
    },
    email: string,
  ): Promise<Partial<User>[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.user.findMany({
      skip,
      take,
      cursor,
      where: {
        ...where,
        NOT: {
          email,
        },
      },
      orderBy,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        img: true,
        bio: true,
        verified: true,
      },
    });
  }

  async createUser(d: CreateUserDto): Promise<User> {
    const default_img = process.env.DEFAULT_PROFILE_IMG;

    // Clean username: trim whitespace and strip @ symbol from start
    const cleanedUsername = d.username.trim().replace(/^@+/, '');

    const data = {
      ...d,
      username: cleanedUsername,
      img: d.img ?? default_img,
      password: await bcrypt.hash(d.password, 10),
    };

    return this.prisma.user.create({
      data,
    });
  }

  async createFedUser(data: CreateFedUserDto): Promise<User> {
    return await this.prisma.user.create({ data });
  }

  async updateUser(params: {
    where: Prisma.UserWhereUniqueInput;
    data: UpdateUserDto;
  }): Promise<User> {
    const { where, data } = params;
    const updated = await this.prisma.user.update({
      data: data as Prisma.UserUpdateInput,
      where,
    });
    return updated as User;
  }

  async deleteUser(where: Prisma.UserWhereUniqueInput): Promise<User> {
    return this.prisma.user.delete({
      where,
    });
  }
}
