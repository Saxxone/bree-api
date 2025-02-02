import { NotificationType, User } from '@prisma/client';
import { IsOptional, IsString, ValidateNested } from 'class-validator';

export type NotificationTypes = 'comment.added' | 'post.created' | 'post.liked';

export class CreateNotificationDto {
  @IsOptional()
  @ValidateNested()
  author?: Partial<User>;

  user: User;

  type: NotificationType;

  @IsString()
  description: string;

  @IsOptional()
  trigger?: any;
}

export interface NotificationObject {
  id: string;
  date: Date;
  author?: Partial<User>;
  description: string;
  trigger?: any;
}

export interface MessageEvent {
  data: NotificationObject;
  id?: string;
  type?: string;
  retry?: number;
}
