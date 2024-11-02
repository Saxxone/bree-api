export class CreateChatDto {
  text: string;
  media?: string;
  mediaType?: string;
  toUserId: string;
  fromUserId: string;
  roomId?: string;
}
