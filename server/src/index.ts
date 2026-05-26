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

// Serve frontend static files when deployed together (single-server mode).
// Try multiple paths: from cwd (production: node dist/server/src/index.js from server/)
// and relative to this file (dev: tsx src/index.ts from server/).
const candidatePaths = [
  path.resolve(process.cwd(), '..', 'dist'),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist'),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'dist'),
];
const frontendDist = candidatePaths.find((p) => fs.existsSync(path.join(p, 'index.html')));
if (frontendDist) {
  app.use(express.static(frontendDist));
  console.log(`Serving frontend from: ${frontendDist}`);
} else {
  console.log('Frontend dist not found, running backend-only');
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
