import { timingSafeEqual } from 'crypto';

const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD;

export function validateTeacherPassword(password: string): boolean {
  if (!TEACHER_PASSWORD) {
    console.warn('TEACHER_PASSWORD not set — auth is disabled (any password accepted)');
    return true;
  }
  const bufA = Buffer.from(password);
  const bufB = Buffer.from(TEACHER_PASSWORD);
  if (bufA.length !== bufB.length) {
    // Constant-time comparison requires equal-length buffers.
    // Use a dummy comparison to avoid leaking length via timing.
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
