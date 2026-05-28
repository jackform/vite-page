import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Try multiple candidate paths for the data directory.
// We prefer directories whose index.json already contains problems.
const candidateDataDirs = [
  path.resolve(__dirname, '..', '..', '..', 'data', 'problems'), // compiled: dist/server/src → server/data
  path.resolve(__dirname, '..', 'data', 'problems'),             // dev (tsx): server/src → server/data
  path.resolve(process.cwd(), 'data', 'problems'),               // from server/ dir
];

function findBestDataDir(): string {
  for (const dir of candidateDataDirs) {
    const idx = path.join(dir, 'index.json');
    if (fs.existsSync(idx)) {
      try {
        const data = JSON.parse(fs.readFileSync(idx, 'utf-8'));
        if (data.problems && Object.keys(data.problems).length > 0) {
          return dir; // existing dir with actual problems
        }
      } catch { /* corrupt index, keep searching */ }
    }
  }
  // Fallback: first directory that exists at all
  for (const dir of candidateDataDirs) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidateDataDirs[0];
}

const DATA_DIR = findBestDataDir();
const INDEX_FILE = path.join(DATA_DIR, 'index.json');

// Ensure the data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(INDEX_FILE)) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify({ version: '1.0', updatedAt: new Date().toISOString(), problems: {} }, null, 2), 'utf-8');
}

export interface ProblemMeta {
  file: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  tags: string[];
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface Problem extends ProblemMeta {
  id: string;
  description: string;
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string[];
  starterCode: string;
  testCases: { input: string; expected: string }[];
  solution?: string;
  hints?: string[];
}

interface IndexData {
  version: string;
  updatedAt: string;
  problems: Record<string, ProblemMeta>;
}

function readIndex(): IndexData {
  const raw = fs.readFileSync(INDEX_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeIndex(data: IndexData): void {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function problemPath(id: string): string {
  return path.join(DATA_DIR, `${id}.json`);
}

export function listProblems(): ProblemMeta[] {
  const index = readIndex();
  return Object.entries(index.problems).map(([id, meta]) => ({
    ...meta,
    id,
  }));
}

export function getProblem(id: string): Problem | null {
  const file = problemPath(id);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf-8');
  return JSON.parse(raw);
}

export function createProblem(problem: Problem): Problem {
  const index = readIndex();

  const now = new Date().toISOString();
  problem.createdAt = now;
  problem.updatedAt = now;

  const meta: ProblemMeta = {
    file: `${problem.id}.json`,
    title: problem.title,
    difficulty: problem.difficulty,
    category: problem.category || '',
    tags: problem.tags || [],
    author: problem.author || 'teacher',
    createdAt: problem.createdAt,
    updatedAt: problem.updatedAt,
  };

  fs.writeFileSync(problemPath(problem.id), JSON.stringify(problem, null, 2), 'utf-8');

  index.problems[problem.id] = meta;
  index.updatedAt = now;
  writeIndex(index);

  return problem;
}

export function updateProblem(id: string, updates: Partial<Problem>): Problem | null {
  const existing = getProblem(id);
  if (!existing) return null;

  const merged: Problem = { ...existing, ...updates, id: existing.id };
  merged.updatedAt = new Date().toISOString();

  fs.writeFileSync(problemPath(id), JSON.stringify(merged, null, 2), 'utf-8');

  const index = readIndex();
  if (index.problems[id]) {
    index.problems[id] = {
      file: `${id}.json`,
      title: merged.title,
      difficulty: merged.difficulty,
      category: merged.category || '',
      tags: merged.tags || [],
      author: merged.author || 'teacher',
      createdAt: merged.createdAt,
      updatedAt: merged.updatedAt,
    };
    index.updatedAt = merged.updatedAt;
    writeIndex(index);
  }

  return merged;
}

export function deleteProblem(id: string): boolean {
  const file = problemPath(id);
  if (!fs.existsSync(file)) return false;

  fs.unlinkSync(file);

  const index = readIndex();
  delete index.problems[id];
  index.updatedAt = new Date().toISOString();
  writeIndex(index);

  return true;
}

export function hasProblem(id: string): boolean {
  return fs.existsSync(problemPath(id));
}
