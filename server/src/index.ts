import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { RoomManager } from './room-manager';
import { registerHandlers } from './handlers';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/types';

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    methods: ['GET', 'POST'],
  },
});

const roomManager = new RoomManager();

app.get('/health', (_req, res) => res.json({ ok: true }));

io.on('connection', (socket) => {
  registerHandlers(io, socket, roomManager);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Python Lab server running on http://localhost:${PORT}`);
});
