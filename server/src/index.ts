import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { RoomManager } from './room-manager.js';
import { ChatStore } from './chat-store.js';
import { registerHandlers } from './handlers.js';
import * as problemStore from './problem-store.js';
import * as studentStore from './student-store.js';
import * as codeStore from './code-store.js';
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
const chatStore = new ChatStore();

app.get('/health', (_req, res) => res.json({ ok: true }));

// ---- Student Account API ----

app.get('/api/students', (_req, res) => {
  try {
    const accounts = studentStore.listStudentAccounts();
    res.json(accounts.map((s) => ({
      studentId: s.studentId,
      name: s.name,
      online: roomManager.isStudentOnline(s.studentId),
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to list students' });
  }
});

app.get('/api/students/:studentId', (req, res) => {
  try {
    const account = studentStore.getStudent(req.params.studentId);
    if (!account) {
      res.json({ exists: false });
      return;
    }
    res.json({
      exists: true,
      name: account.name,
      hasPin: account.pinHash !== null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check student' });
  }
});

app.post('/api/students', (req, res) => {
  try {
    const { studentId, name } = req.body;
    if (!studentId || !name) {
      res.status(400).json({ error: 'studentId and name are required' });
      return;
    }
    if (studentStore.hasStudent(studentId)) {
      res.status(409).json({ error: 'Student already exists' });
      return;
    }
    const account = studentStore.createStudent({ studentId, name });
    res.status(201).json({ studentId: account.studentId, name: account.name, hasPin: false });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create student' });
  }
});

app.post('/api/students/register', (req, res) => {
  try {
    const { studentId, name, pin } = req.body;
    if (!studentId || !name || !pin) {
      res.status(400).json({ error: 'studentId, name, and pin are required' });
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      res.status(400).json({ error: 'PIN must be 4 digits' });
      return;
    }
    if (studentStore.hasStudent(studentId)) {
      res.status(409).json({ error: 'Student already exists' });
      return;
    }
    const account = studentStore.createStudent({ studentId, name, pin });
    res.status(201).json({ studentId: account.studentId, name: account.name });
  } catch (err) {
    res.status(500).json({ error: 'Failed to register student' });
  }
});

app.post('/api/students/verify', (req, res) => {
  try {
    const { studentId, pin } = req.body;
    if (!studentId || !pin) {
      res.status(400).json({ error: 'studentId and pin are required' });
      return;
    }
    const account = studentStore.getStudent(studentId);
    if (!account) {
      res.json({ success: false, error: 'Student not found' });
      return;
    }
    if (!account.pinHash) {
      res.json({ success: false, error: 'No PIN set. Please register first.' });
      return;
    }
    if (!studentStore.verifyPin(studentId, pin)) {
      res.json({ success: false, error: 'PIN 不正確' });
      return;
    }
    res.json({ success: true, student: { studentId: account.studentId, name: account.name } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify PIN' });
  }
});

app.post('/api/students/set-pin', (req, res) => {
  try {
    const { studentId, pin } = req.body;
    if (!studentId || !pin) {
      res.status(400).json({ error: 'studentId and pin are required' });
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      res.status(400).json({ error: 'PIN must be 4 digits' });
      return;
    }
    const account = studentStore.getStudent(studentId);
    if (!account) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    const updated = studentStore.setPin(studentId, pin);
    res.json({ studentId: updated!.studentId, name: updated!.name });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set PIN' });
  }
});

app.delete('/api/students/:studentId', (req, res) => {
  try {
    const ok = studentStore.deleteStudent(req.params.studentId);
    if (!ok) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// ---- Code Persistence API ----

app.get('/api/students/:studentId/code/:problemId', (req, res) => {
  try {
    const data = codeStore.getCode(req.params.studentId, req.params.problemId);
    if (!data) {
      res.status(404).json({ error: 'No saved code found' });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get saved code' });
  }
});

app.put('/api/students/:studentId/code/:problemId', (req, res) => {
  try {
    const { code } = req.body;
    if (typeof code !== 'string') {
      res.status(400).json({ error: 'code is required' });
      return;
    }
    const data = codeStore.saveCode(req.params.studentId, req.params.problemId, code);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save code' });
  }
});

app.get('/api/students/:studentId/classroom-status', (req, res) => {
  try {
    // Register heartbeat for online-status tracking
    roomManager.markStudentSeen(req.params.studentId);
    const problem = roomManager.getPendingClassroom(req.params.studentId);
    if (problem) {
      res.json({ classroom: true, problem });
    } else {
      res.json({ classroom: false });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to check classroom status' });
  }
});

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
  registerHandlers(io, socket, roomManager, chatStore);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Python Lab server running on http://localhost:${PORT}`);
});
