export class ChatCreatedEvent {
  constructor(data: { name: string; description: string; fromUserId: string }) {
    this.name = data.name;
    this.description = data.description;
    this.fromUserId = data.fromUserId;
  }

  name: string;
  description: string;
  fromUserId: string;
}
