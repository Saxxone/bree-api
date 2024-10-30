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
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { OnEvent } from '@nestjs/event-emitter';
import { ChatCreatedEvent } from './events/chat.event';
import { Chat as ChatModel } from '@prisma/client';



@WebSocketGateway()
export class ChatGateway {
  constructor(private readonly chatService: ChatService) {}

  @SubscribeMessage('create')
  async createChat(
    @Request() req: any,
    @MessageBody() chatData: CreateChatDto,
  ): Promise<ChatModel> {
    return await this.chatService.create(chatData, req.user.sub as string);
  }
}

@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @OnEvent('chat.created')
  handleOrderCreatedEvent(payload: ChatCreatedEvent) {
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
    return this.chatService.update(+id, updateChatDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.chatService.remove(+id);
  }
}
