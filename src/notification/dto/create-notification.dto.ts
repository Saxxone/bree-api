import { User } from '@prisma/client';

export class CreateNotificationDto {}

export interface NotificationObject {
  id: string;
  date: Date;
  author?: Partial<User>;
  description: string;
}

export interface MessageEvent {
  data: NotificationObject;
  id?: string;
  type?: string;
  retry?: number;
}
