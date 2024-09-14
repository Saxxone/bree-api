import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { User, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';


@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findUser(
    userWhereUniqueInput: Prisma.UserWhereUniqueInput,
  ): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: userWhereUniqueInput,
    });
  }

  async getMultipleUsers(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.UserWhereUniqueInput;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<User[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.user.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
    });
  }
  
  async createUser(data: Prisma.UserCreateInput): Promise<User> {
    data = {
      ...data,
      img: data.img ?? 'https://randomuser.me/api/portraits/men/90.jpg',
      password: await bcrypt.hash(data.password, 10)
    };

    return this.prisma.user.create({
      data
    });
  }

  async login(data: {
    email: string;
    password: string;
  }): Promise<Partial<User>> {

    const user = await this.prisma.user.findUnique({
      where: {
        email: data.email 
      } 
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      img: user.img
    };
  }

  async updateUser(params: {
    where: Prisma.UserWhereUniqueInput;
    data: Prisma.UserUpdateInput;
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
