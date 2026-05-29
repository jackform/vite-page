import type { ChatMessage } from '../../shared/types.js';

export class ChatStore {
  private messagesByRoom: Map<string, ChatMessage[]> = new Map();

  addMessage(partial: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
    const msg: ChatMessage = {
      ...partial,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    const existing = this.messagesByRoom.get(partial.roomId);
    if (existing) {
      existing.push(msg);
    } else {
      this.messagesByRoom.set(partial.roomId, [msg]);
    }

    return msg;
  }

  getHistory(roomId: string): ChatMessage[] {
    const messages = this.messagesByRoom.get(roomId);
    return messages ? [...messages] : [];
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
