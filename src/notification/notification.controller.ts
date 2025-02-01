import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Sse,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Observable, interval, map } from 'rxjs';
import { Public } from 'src/auth/auth.guard';
import {
  CreateNotificationDto,
  MessageEvent,
} from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Cron('* * 0 * * *', {
    name: 'notifications',
    timeZone: 'Europe/London',
  })
  triggerNotifications() {}

  @Public()
  @Sse('sse')
  @Header('Content-Type', 'text/event-stream')
  sse(): Observable<MessageEvent> {
    return interval(10000).pipe(
      map(() => ({
        data: {
          author: {
            name: 'Stephen',
            id: '1',
            email: 'saxxone17@gmail.com',
            username: 'saxxone',
            bio: '',
            verified: true,
            banner: '',
            img: '',
          },
          description: 'replied to your chat',
          date: new Date(),
          id: '1',
        },
      })),
    );
  }

  @Post()
  create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationService.create(createNotificationDto);
  }

  @Get()
  findAll() {
    return this.notificationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.notificationService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
  ) {
    return this.notificationService.update(id, updateNotificationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.notificationService.remove(id);
  }
}
