import type { Socket } from 'socket.io-client';
import type { ChatMessage, ClientToServerEvents, ServerToClientEvents } from '../../shared/types';

export class ChatClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private roomId: string;
  private senderType: 'student' | 'teacher';
  private messageHandlers: Set<(msg: ChatMessage) => void> = new Set();
  private historyHandlers: Set<(...args: any[]) => void> = new Set();
  private boundOnMessage: (msg: ChatMessage) => void;

  constructor(
    socket: Socket<ServerToClientEvents, ClientToServerEvents>,
    roomId: string,
    senderType: 'student' | 'teacher'
  ) {
    this.socket = socket;
    this.roomId = roomId;
    this.senderType = senderType;

    this.boundOnMessage = (msg: ChatMessage) => {
      if (msg.roomId === this.roomId) {
        this.messageHandlers.forEach((h) => h(msg));
      }
    };
    this.socket.on('chat:message', this.boundOnMessage);
  }

  sendMessage(text?: string, imageUrl?: string): void {
    this.socket.emit('chat:send', {
      roomId: this.roomId,
      sender: this.senderType,
      text,
      imageUrl,
    });
  }

  onMessage(handler: (msg: ChatMessage) => void): void {
    this.messageHandlers.add(handler);
  }

  onHistory(handler: (messages: ChatMessage[]) => void): void {
    const historyHandler = (data: { roomId: string; messages: ChatMessage[] }) => {
      if (data.roomId === this.roomId) {
        handler(data.messages);
        this.socket.off('chat:history', historyHandler);
        this.historyHandlers.delete(historyHandler);
      }
    };
    this.historyHandlers.add(historyHandler);
    this.socket.on('chat:history', historyHandler);
  }

  destroy(): void {
    this.messageHandlers.clear();
    this.socket.off('chat:message', this.boundOnMessage);
    for (const h of this.historyHandlers) {
      this.socket.off('chat:history', h);
    }
    this.historyHandlers.clear();
  }
}
