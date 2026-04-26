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
import { Observable, filter, fromEventPattern, map, merge } from 'rxjs';
import {
  MessageEvent,
  NotificationObject,
  NotificationTypes,
} from './dto/create-notification.dto';
import {
  RegisterPushTokenDto,
  RemovePushTokenDto,
} from './dto/register-push-token.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { ExpoPushService } from './expo-push.service';
import { NotificationService } from './notification.service';
import type { JwtPayload } from 'src/auth/auth.guard';

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly eventEmitter: EventEmitter2,
    private readonly expoPushService: ExpoPushService,
  ) {}

  @Cron('* * 0 * * *', {
    name: 'notifications',
    timeZone: 'Europe/London',
  })
  triggerNotifications() {}

  @Sse('sse')
  @Header('Content-Type', 'text/event-stream')
  async sse(
    @Request() req: { user: JwtPayload },
  ): Promise<Observable<MessageEvent>> {
    const userId = req.user.userId;
    const handleEvent = (type: NotificationTypes) =>
      fromEventPattern<NotificationObject>(
        (handler) => this.eventEmitter.on(type, handler),
        (handler) => this.eventEmitter.off(type, handler),
      ).pipe(
        map((event) => ({ data: event })),
        filter((msg) => {
          const ev = msg.data as { user?: { id?: string } };
          return ev?.user?.id === userId;
        }),
      );

    const postCreated$ = handleEvent('post.created');
    const commentAdded$ = handleEvent('comment.added');
    const postLiked$ = handleEvent('post.liked');

    return merge(postCreated$, commentAdded$, postLiked$);
  }

  @Post('push-token')
  async registerPushToken(
    @Request() req: { user: JwtPayload },
    @Body() body: RegisterPushTokenDto,
  ) {
    await this.expoPushService.registerToken(
      req.user.userId,
      body.token,
      body.platform ?? 'unknown',
    );
    return { ok: true as const };
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
  findOne(@Param('id') id: string, @Request() req: { user: JwtPayload }) {
    return this.notificationService.findOneForUser(id, req.user.userId);
  }

  @Patch('read-all')
  markAllRead(@Request() req: { user: JwtPayload }) {
    return this.notificationService.markAllRead(req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Request() req: { user: JwtPayload },
    @Body() updateNotificationDto: UpdateNotificationDto,
  ) {
    return this.notificationService.update(
      id,
      req.user.userId,
      updateNotificationDto,
    );
  }

  @Delete('push-token')
  async removePushToken(
    @Request() req: { user: JwtPayload },
    @Body() body: RemovePushTokenDto,
  ) {
    await this.expoPushService.unregisterToken(req.user.userId, body.token);
    return { ok: true as const };
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: { user: JwtPayload }) {
    return this.notificationService.removeForUser(id, req.user.userId);
  }
}
