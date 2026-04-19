import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Sse,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { Observable, fromEventPattern, map, merge } from 'rxjs';
import {
  CreateNotificationDto,
  MessageEvent,
  NotificationObject,
  NotificationTypes,
} from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationService } from './notification.service';
import type { JwtPayload } from 'src/auth/auth.guard';

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron('* * 0 * * *', {
    name: 'notifications',
    timeZone: 'Europe/London',
  })
  triggerNotifications() {}

  @Sse('sse')
  @Header('Content-Type', 'text/event-stream')
  async sse(): Promise<Observable<MessageEvent>> {
    const handleEvent = (type: NotificationTypes) =>
      fromEventPattern<NotificationObject>(
        (handler) => this.eventEmitter.on(type, handler),
        (handler) => this.eventEmitter.off(type, handler),
      ).pipe(
        map((event) => ({
          data: event,
        })),
      );

    const postCreated$ = handleEvent('post.created');
    const commentAdded$ = handleEvent('comment.added');
    const postLiked$ = handleEvent('post.liked');

    return merge(postCreated$, commentAdded$, postLiked$);
  }

  @Post()
  create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationService.create(createNotificationDto);
  }

  @Get()
  findAll(
    @Request() req: { user: JwtPayload },
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const s = Number.parseInt(String(skip ?? '0'), 10);
    const t = Number.parseInt(String(take ?? '50'), 10);
    return this.notificationService.findAll(
      Number.isFinite(s) ? Math.max(0, s) : 0,
      Number.isFinite(t) ? Math.min(Math.max(1, t), 100) : 50,
      req.user.userId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.notificationService.findOne(id);
  }

  @Patch('read-all')
  markAllRead(@Request() req: { user: JwtPayload }) {
    return this.notificationService.markAllRead(req.user.userId);
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
