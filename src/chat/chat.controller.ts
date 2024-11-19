import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  Request,
} from '@nestjs/common';

import { UpdateChatDto } from './dto/update-chat.dto';
import { OnEvent } from '@nestjs/event-emitter';
import { ChatService } from './chat.service';

@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @OnEvent('chat.created')
  handleOrderCreatedEvent() {
    // handle and process "ChatCreatedEvent" event
  }

  @Get('view/:id')
  findAll(@Request() req: any, @Param('id') id: 'uuid') {
    return this.chatService.findAll(id, req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.chatService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateChatDto: UpdateChatDto) {
    return this.chatService.update(+id, +updateChatDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.chatService.remove(+id);
  }
}
