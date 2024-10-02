export class CreateChatDto<T> {
  name: string;
  description: string;
  actor: T;
}
