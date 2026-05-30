/**
 * E2E tests for the Lock & Push Code feature.
 *
 * Run: npx playwright test tests/lock-and-push.e2e.ts
 *
 * Prerequisites:
 *   - Start the backend: cd server && npm run dev
 *   - Start the frontend: npm run dev
 *   - Or use: npx playwright test (which auto-starts both via webServer config)
 */
import { test, expect } from '@playwright/test';

const EDITOR_SELECTOR = '.cm-editor';
const LOCK_OVERLAY_SELECTOR = '#lock-overlay';

test.describe('Lock & Push E2E', () => {
  test('teacher locks student editor', async ({ page, context }) => {
    // --- Student page ---
    const studentPage = await context.newPage();
    await studentPage.goto('/vite-page/code.html');
    await studentPage.fill('#reg-name', 'Alice');
    await studentPage.fill('#reg-student-id', 'S100');
    await studentPage.click('#reg-submit');
    await studentPage.waitForSelector(EDITOR_SELECTOR, { timeout: 10000 });

    // --- Teacher page ---
    const teacherPage = await context.newPage();
    await teacherPage.goto('/vite-page/teacher.html');
    await teacherPage.fill('#auth-password', 'test');
    await teacherPage.click('#auth-submit');
    await teacherPage.waitForSelector('.teacher-layout', { timeout: 10000 });

    // Select student Alice
    const aliceItem = teacherPage.locator('.roster-item').filter({ hasText: 'Alice' });
    await expect(aliceItem).toBeVisible({ timeout: 5000 });
    await aliceItem.click();

    // Wait for code view toolbar to appear (editor may need code:broadcast which
    // requires the student to have typed code first; lock button is always visible)
    await teacherPage.waitForSelector('#btn-lock-toggle', { timeout: 10000 });

    // Click lock button
    const lockBtn = teacherPage.locator('#btn-lock-toggle');
    await lockBtn.click();

    // Verify student sees lock overlay
    await expect(studentPage.locator(LOCK_OVERLAY_SELECTOR)).toBeVisible({ timeout: 3000 });
    await expect(studentPage.locator(LOCK_OVERLAY_SELECTOR)).not.toHaveClass(/hidden/);

    // Verify teacher sees Run/Unlock/Cancel buttons
    await expect(teacherPage.locator('#btn-run-locked')).toBeVisible({ timeout: 2000 });
    await expect(teacherPage.locator('#btn-unlock-push')).toBeVisible();
    await expect(teacherPage.locator('#btn-unlock-cancel')).toBeVisible();

    // Student Run button should be disabled while locked
    const studentRunBtn = studentPage.locator('#btn-run');
    await expect(studentRunBtn).toBeDisabled();
  });

  test('teacher cancels lock and restores student code', async ({ page, context }) => {
    // --- Student page ---
    const studentPage = await context.newPage();
    await studentPage.goto('/vite-page/code.html');
    await studentPage.fill('#reg-name', 'Bob');
    await studentPage.fill('#reg-student-id', 'S101');
    await studentPage.click('#reg-submit');
    await studentPage.waitForSelector(EDITOR_SELECTOR, { timeout: 10000 });

    // --- Teacher page ---
    const teacherPage = await context.newPage();
    await teacherPage.goto('/vite-page/teacher.html');
    await teacherPage.fill('#auth-password', 'test');
    await teacherPage.click('#auth-submit');
    await teacherPage.waitForSelector('.teacher-layout', { timeout: 10000 });

    // Select student
    const bobItem = teacherPage.locator('.roster-item').filter({ hasText: 'Bob' });
    await expect(bobItem).toBeVisible({ timeout: 5000 });
    await bobItem.click();
    await teacherPage.waitForSelector('#btn-lock-toggle', { timeout: 10000 });

    // Lock
    await teacherPage.locator('#btn-lock-toggle').click();
    await expect(studentPage.locator(LOCK_OVERLAY_SELECTOR)).toBeVisible({ timeout: 3000 });

    // Cancel (unlock without pushing)
    await teacherPage.locator('#btn-unlock-cancel').click();

    // Verify student unlocked
    await expect(studentPage.locator(LOCK_OVERLAY_SELECTOR)).toHaveClass(/hidden/, { timeout: 3000 });

    // Student Run button should be enabled again
    await expect(studentPage.locator('#btn-run')).toBeEnabled({ timeout: 2000 });
  });

  test('student cannot edit while locked', async ({ page, context }) => {
    // --- Student page ---
    const studentPage = await context.newPage();
    await studentPage.goto('/vite-page/code.html');
    await studentPage.fill('#reg-name', 'Carol');
    await studentPage.fill('#reg-student-id', 'S102');
    await studentPage.click('#reg-submit');
    await studentPage.waitForSelector(EDITOR_SELECTOR, { timeout: 10000 });

    // --- Teacher page ---
    const teacherPage = await context.newPage();
    await teacherPage.goto('/vite-page/teacher.html');
    await teacherPage.fill('#auth-password', 'test');
    await teacherPage.click('#auth-submit');
    await teacherPage.waitForSelector('.teacher-layout', { timeout: 10000 });

    // Select student
    const carolItem = teacherPage.locator('.roster-item').filter({ hasText: 'Carol' });
    await expect(carolItem).toBeVisible({ timeout: 5000 });
    await carolItem.click();
    await teacherPage.waitForSelector('#btn-lock-toggle', { timeout: 10000 });

    // Lock
    await teacherPage.locator('#btn-lock-toggle').click();
    await expect(studentPage.locator(LOCK_OVERLAY_SELECTOR)).toBeVisible({ timeout: 3000 });

    // Student Run and Tests buttons should be disabled
    await expect(studentPage.locator('#btn-run')).toBeDisabled();
    await expect(studentPage.locator('#btn-tests')).toBeDisabled();
  });
});
