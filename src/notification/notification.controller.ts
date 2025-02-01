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
  Req,
  Sse,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { Observable, fromEventPattern, map, merge } from 'rxjs';
import {
  CreateNotificationDto,
  MessageEvent,
  NotificationTypes
} from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  @Cron('* * 0 * * *', {
    name: 'notifications',
    timeZone: 'Europe/London',
  })
  triggerNotifications() {}

  @Sse('sse')
  @Header('Content-Type', 'text/event-stream')
  async sse(@Req() request: any): Promise<Observable<MessageEvent>> {
    const handleEvent = (type: NotificationTypes) =>
      fromEventPattern(
        (handler) => this.eventEmitter.on(type, handler),
        (handler) => this.eventEmitter.off(type, handler),
      ).pipe(
        map((event: any) => ({
          data: event,
        })),
      );

    const postCreated$ = handleEvent('post.created');
    const commentAdded$ = handleEvent('comment.added');

    return merge(postCreated$, commentAdded$);
  }

  @Post()
  create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationService.create(createNotificationDto);
  }

  @Get()
  findAll(@Query('skip') skip: number, @Query('take') take: number) {
    return this.notificationService.findAll(skip, take);
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
