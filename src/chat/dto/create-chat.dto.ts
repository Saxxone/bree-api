export class CreateChatDto {
  text: ArrayBuffer;
  media?: string;
  mediaType?: string;
  toUserId: string;
  fromUserId: string;
  roomId?: string;
}
