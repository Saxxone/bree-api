export class ChatCreatedEvent<T> {
  constructor(data: { name: string; description: string; actor: T }) {
    this.name = data.name;
    this.description = data.description;
    this.actor = data.actor;
  }

  name: string;
  description: string;
  actor: T;
}
