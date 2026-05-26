import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { RoomManager } from './room-manager';
import { registerHandlers } from './handlers';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/types';

const app = express();

// Trust proxy for nginx reverse proxy setups
app.set('trust proxy', 1);

// Serve frontend static files when deployed together (single-server mode)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, '..', '..', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  console.log(`Serving frontend from: ${frontendDist}`);
}

const server = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
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
