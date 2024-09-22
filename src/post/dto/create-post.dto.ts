import { User, User as UserModel } from '@prisma/client';

export class PostDto {
  id: number;
  date: Date;
  title: string;
  text: string;
  author: User;
  img?: string;
}
