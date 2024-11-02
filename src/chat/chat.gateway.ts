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
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { OnEvent } from '@nestjs/event-emitter';
import { ChatCreatedEvent } from './events/chat.event';
import { Chat as ChatModel } from '@prisma/client';
import { ChatService } from './chat.service';
import { ui_base_url } from 'utils';

@WebSocketGateway({
  cors: {
    namespace: 'chat',
    origin: '*',
    transports: ['websocket'],
  },
})
export class ChatGateway {
  constructor(private readonly chatService: ChatService) {}

  @WebSocketServer()
  server: Server;

  // @SubscribeMessage('chat')
  // handleEvent(client: Socket, data: string): string {
  //   console.log(data);
  //   return data;
  // }

  @SubscribeMessage('chat')
  async createChat(@MessageBody() chatData: CreateChatDto) {
    console.log(chatData);
    return await this.chatService.create(
      chatData,
      'saxxone17@gmail.com' as string,
    );
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
