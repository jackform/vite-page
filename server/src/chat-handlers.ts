import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/types.js';
import { ChatStore } from './chat-store.js';
import { RoomManager } from './room-manager.js';

export function registerChatHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  chatStore: ChatStore,
  teacherWatching: Map<string, string>,
  roomManager: RoomManager
): void {
  socket.on('chat:send', (data) => {
    // Validate: must have text or imageUrl
    if (!data.text && !data.imageUrl) {
      return;
    }
    if (data.text && data.text.length > 2000) {
      return;
    }
    if (data.imageUrl && data.imageUrl.length > 600_000) {
      return;
    }

    let roomId: string;
    let sender: 'student' | 'teacher';

    if (socket.data.isTeacher) {
      const watchingRoom = teacherWatching.get(socket.id);
      if (!watchingRoom) return;
      roomId = watchingRoom;
      sender = 'teacher';
    } else {
      const student = roomManager.getStudentBySocket(socket.id);
      if (!student) return;
      if (data.roomId !== student.roomId) return;
      roomId = student.roomId;
      sender = 'student';
    }

    const msg = chatStore.addMessage({
      roomId,
      sender,
      text: data.text,
      imageUrl: data.imageUrl,
    });

    io.to(roomId).emit('chat:message', msg);
  });
}
