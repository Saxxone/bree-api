import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { User, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateFedUserDto, CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findUser(
    usernameOrEmail: string,
    options?: {
      withPassword?: boolean;
      withPublicKey?: boolean;
    },
  ): Promise<User | null> {
    const searchTerm = usernameOrEmail.startsWith('@')
      ? usernameOrEmail
      : `@${usernameOrEmail}`;

    const user = await this.prisma.user.findFirst({
      ...(options?.withPassword && {
        select: {
          password: options?.withPassword,
          id: true,
          email: true,
          username: true,
          img: true,
          publicKey: true,
          bio: true,
          verified: true,
        },
      }),

      where: {
        OR: [
          { username: searchTerm },
          { email: usernameOrEmail },
          { id: usernameOrEmail },
        ],
      },
    });

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
    with_pk?: boolean,
  ): Promise<Partial<User>[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.user.findMany({
      skip,
      take,
      cursor,
      where: {
        ...where,
        NOT: {  
          email
        }
      },
      orderBy,
      select: {
        id: true,
        email: true,
        username: true,
        img: true,
        bio: true,
        verified: true,

        ...(with_pk && { publicKey: true }),
      },
    
    });
  }

  async createUser(d: CreateUserDto): Promise<User> {
    const default_img = process.env.DEFAULT_PROFILE_IMG;

    const data = {
      ...d,
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
    return this.prisma.user.update({
      data,
      where,
    });
  }

  async deleteUser(where: Prisma.UserWhereUniqueInput): Promise<User> {
    return this.prisma.user.delete({
      where,
    });
  }
}
