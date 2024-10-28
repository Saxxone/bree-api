import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { OnEvent } from '@nestjs/event-emitter';
import { ChatCreatedEvent } from './events/chat.event';
import { User, Chat as ChatModel } from '@prisma/client';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @OnEvent('chat.created')
  handleOrderCreatedEvent(payload: ChatCreatedEvent<User>) {
    // handle and process "ChatCreatedEvent" event
  }

  @Post()
  create(@Body() createChatDto: CreateChatDto<User>) {
    return this.chatService.create<User>(createChatDto);
  }

  @Post('create-chat')
  async createChat(
    @Request() req: any,
    @Body() chatData: CreateChatDto<User>,
  ): Promise<string> {
    return await this.chatService.create(chatData);
  }

  @Get()
  findAll() {
    return this.chatService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.chatService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateChatDto: UpdateChatDto) {
    return this.chatService.update(+id, updateChatDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.chatService.remove(+id);
  }
}
