import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

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

const DATA_DIR = findBestDataDir();
const INDEX_FILE = path.join(DATA_DIR, 'index.json');

// Ensure the data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(INDEX_FILE)) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify({ students: [] }, null, 2), 'utf-8');
}

export interface StudentAccount {
  studentId: string;
  name: string;
  pinHash: string | null; // null when teacher pre-registers without PIN
  createdAt: string;
}

interface IndexData {
  students: string[];
}

function readIndex(): IndexData {
  const raw = fs.readFileSync(INDEX_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeIndex(data: IndexData): void {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function studentPath(id: string): string {
  return path.join(DATA_DIR, `${id}.json`);
}

export function listStudents(): string[] {
  return readIndex().students;
}

export function listStudentAccounts(): StudentAccount[] {
  return readIndex().students
    .map((id) => getStudent(id))
    .filter((s): s is StudentAccount => s !== null);
}

export function getStudent(id: string): StudentAccount | null {
  const file = studentPath(id);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf-8');
  return JSON.parse(raw);
}

export function hasStudent(id: string): boolean {
  return fs.existsSync(studentPath(id));
}

export function createStudent(data: {
  studentId: string;
  name: string;
  pin?: string;
}): StudentAccount {
  const index = readIndex();

  const account: StudentAccount = {
    studentId: data.studentId,
    name: data.name,
    pinHash: data.pin ? bcrypt.hashSync(data.pin, 10) : null,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(studentPath(data.studentId), JSON.stringify(account, null, 2), 'utf-8');

  if (!index.students.includes(data.studentId)) {
    index.students.push(data.studentId);
    writeIndex(index);
  }

  return account;
}

export function deleteStudent(id: string): boolean {
  const file = studentPath(id);
  if (!fs.existsSync(file)) return false;

  fs.unlinkSync(file);

  const index = readIndex();
  index.students = index.students.filter((s) => s !== id);
  writeIndex(index);

  return true;
}

export function verifyPin(id: string, pin: string): boolean {
  const account = getStudent(id);
  if (!account || !account.pinHash) return false;
  return bcrypt.compareSync(pin, account.pinHash);
}

export function setPin(id: string, pin: string): StudentAccount | null {
  const account = getStudent(id);
  if (!account) return null;

  account.pinHash = bcrypt.hashSync(pin, 10);
  fs.writeFileSync(studentPath(id), JSON.stringify(account, null, 2), 'utf-8');
  return account;
}
