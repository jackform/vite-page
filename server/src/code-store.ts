import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { SavedCodeData } from '../../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Try multiple candidate paths for the data directory.
const candidateDataDirs = [
  path.resolve(__dirname, '..', '..', '..', 'data', 'students'), // compiled: dist/server/src → server/data
  path.resolve(__dirname, '..', 'data', 'students'),             // dev (tsx): server/src → server/data
  path.resolve(process.cwd(), 'data', 'students'),               // from server/ dir
];

function findBestDataDir(): string {
  for (const dir of candidateDataDirs) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidateDataDirs[1]; // dev path as fallback
}

const STUDENTS_DIR = findBestDataDir();

function codeDir(studentId: string): string {
  return path.join(STUDENTS_DIR, studentId, 'code');
}

function codePath(studentId: string, problemId: string): string {
  return path.join(codeDir(studentId), `${problemId}.json`);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getCode(studentId: string, problemId: string): SavedCodeData | null {
  const file = codePath(studentId, problemId);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf-8');
  return JSON.parse(raw);
}

export function saveCode(studentId: string, problemId: string, code: string): SavedCodeData {
  const dir = codeDir(studentId);
  ensureDir(dir);

  const data: SavedCodeData = {
    studentId,
    problemId,
    code,
    savedAt: new Date().toISOString(),
  };

  fs.writeFileSync(codePath(studentId, problemId), JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

export function deleteCode(studentId: string, problemId: string): boolean {
  const file = codePath(studentId, problemId);
  if (!fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  return true;
}

export function listCodes(studentId: string): string[] {
  const dir = codeDir(studentId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
}
