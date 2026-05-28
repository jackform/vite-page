import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { RoomManager } from './room-manager.js';
import { registerHandlers } from './handlers.js';
import * as problemStore from './problem-store.js';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/types.js';

const app = express();

// Trust proxy for nginx reverse proxy setups
app.set('trust proxy', 1);
app.use(express.json());

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
  app.use('/vite-page', express.static(frontendDist));
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

// ---- Problem CRUD API ----

app.get('/api/problems', (_req, res) => {
  try {
    res.json(problemStore.listProblems());
  } catch (err) {
    res.status(500).json({ error: 'Failed to list problems' });
  }
});

app.get('/api/problems/:id', (req, res) => {
  try {
    const problem = problemStore.getProblem(req.params.id);
    if (!problem) {
      res.status(404).json({ error: 'Problem not found' });
      return;
    }
    res.json(problem);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get problem' });
  }
});

app.post('/api/problems', (req, res) => {
  try {
    const problem = problemStore.createProblem(req.body);
    res.status(201).json(problem);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create problem' });
  }
});

app.put('/api/problems/:id', (req, res) => {
  try {
    const updated = problemStore.updateProblem(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Problem not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update problem' });
  }
});

app.delete('/api/problems/:id', (req, res) => {
  try {
    const ok = problemStore.deleteProblem(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Problem not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete problem' });
  }
});

io.on('connection', (socket) => {
  registerHandlers(io, socket, roomManager);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Python Lab server running on http://localhost:${PORT}`);
});
