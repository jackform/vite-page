/**
 * E2E tests for the guidance push feature.
 *
 * Run: npx playwright test tests/guidance.e2e.ts
 *
 * Prerequisites: web servers auto-started via playwright.config.ts
 */
import { test, expect } from '@playwright/test';

test.describe('Guidance Push E2E', () => {
  test('teacher pushes guidance with text — student sees custom description, banner, and restore button', async ({
    page,
    context,
  }) => {
    // --- Student page ---
    const studentPage = await context.newPage();
    await studentPage.goto('/vite-page/code.html');
    await studentPage.fill('#reg-name', 'Carol');
    await studentPage.fill('#reg-student-id', 'S010');
    await studentPage.click('#reg-submit');
    await studentPage.waitForSelector('.cm-editor', { timeout: 10000 });
    // Wait for the problem description to appear
    await studentPage.waitForSelector('.problem-description', { timeout: 10000 });

    // Capture original description text
    const originalDesc = await studentPage.locator('.problem-description').innerText();

    // --- Teacher page ---
    const teacherPage = await context.newPage();
    await teacherPage.goto('/vite-page/teacher.html');
    await teacherPage.fill('#auth-password', 'test');
    await teacherPage.click('#auth-submit');
    await teacherPage.waitForSelector('.teacher-layout', { timeout: 10000 });

    // Select student Carol
    const carolItem = teacherPage.locator('.roster-item').filter({ hasText: 'Carol' });
    await expect(carolItem).toBeVisible({ timeout: 5000 });
    await carolItem.click();

    // Switch to guidance tab (default is code view)
    await teacherPage.locator('.monitor-view-tab[data-view="guidance"]').click();

    // Wait for guidance editor to be visible
    const guidanceEditor = teacherPage.locator('#guidance-editor');
    await expect(guidanceEditor).toBeVisible({ timeout: 5000 });

    // Fill in custom guidance text
    const customGuidance = '## 教師提示\n\n請嘗試使用 **for 迴圈** 來解決這個問題。\n\n- 第一步：先建立一個空列表\n- 第二步：使用迴圈迭代';
    await guidanceEditor.fill(customGuidance);

    // Push guidance
    await teacherPage.click('#btn-guidance-push');

    // --- Student side: verify guidance applied ---
    // Banner should appear
    await expect(studentPage.locator('.guidance-banner')).toBeVisible({ timeout: 5000 });
    await expect(studentPage.locator('.guidance-banner-text')).toContainText('教師指導中');

    // Description should be replaced with custom guidance
    await expect(studentPage.locator('.problem-description')).not.toContainText(originalDesc, { timeout: 5000 });

    // Restore button should be visible
    await expect(studentPage.locator('#btn-guidance-restore')).toBeVisible();
  });

  test('student restores original description after guidance', async ({ page, context }) => {
    // --- Student page ---
    const studentPage = await context.newPage();
    await studentPage.goto('/vite-page/code.html');
    await studentPage.fill('#reg-name', 'Dave');
    await studentPage.fill('#reg-student-id', 'S011');
    await studentPage.click('#reg-submit');
    await studentPage.waitForSelector('.cm-editor', { timeout: 10000 });
    await studentPage.waitForSelector('.problem-description', { timeout: 10000 });

    const originalDesc = await studentPage.locator('.problem-description').innerText();

    // --- Teacher page ---
    const teacherPage = await context.newPage();
    await teacherPage.goto('/vite-page/teacher.html');
    await teacherPage.fill('#auth-password', 'test');
    await teacherPage.click('#auth-submit');
    await teacherPage.waitForSelector('.teacher-layout', { timeout: 10000 });

    const daveItem = teacherPage.locator('.roster-item').filter({ hasText: 'Dave' });
    await expect(daveItem).toBeVisible({ timeout: 5000 });
    await daveItem.click();

    // Switch to guidance tab
    await teacherPage.locator('.monitor-view-tab[data-view="guidance"]').click();

    const guidanceEditor = teacherPage.locator('#guidance-editor');
    await expect(guidanceEditor).toBeVisible({ timeout: 5000 });

    await guidanceEditor.fill('Temporary guidance text');
    await teacherPage.click('#btn-guidance-push');

    // Verify guidance is active on student side
    await expect(studentPage.locator('.guidance-banner')).toBeVisible({ timeout: 5000 });

    // Click restore
    await studentPage.click('#btn-guidance-restore');

    // Banner should be gone
    await expect(studentPage.locator('.guidance-banner')).not.toBeVisible({ timeout: 5000 });

    // Original description should be restored
    await expect(studentPage.locator('.problem-description')).toContainText(originalDesc, { timeout: 5000 });
  });

  test('pushing a new problem clears active guidance', async ({ page, context }) => {
    // --- Student page ---
    const studentPage = await context.newPage();
    await studentPage.goto('/vite-page/code.html');
    await studentPage.fill('#reg-name', 'Eve');
    await studentPage.fill('#reg-student-id', 'S012');
    await studentPage.click('#reg-submit');
    await studentPage.waitForSelector('.cm-editor', { timeout: 10000 });
    await studentPage.waitForSelector('.problem-description', { timeout: 10000 });

    // --- Teacher page ---
    const teacherPage = await context.newPage();
    await teacherPage.goto('/vite-page/teacher.html');
    await teacherPage.fill('#auth-password', 'test');
    await teacherPage.click('#auth-submit');
    await teacherPage.waitForSelector('.teacher-layout', { timeout: 10000 });

    const eveItem = teacherPage.locator('.roster-item').filter({ hasText: 'Eve' });
    await expect(eveItem).toBeVisible({ timeout: 5000 });
    await eveItem.click();

    // Switch to guidance tab
    await teacherPage.locator('.monitor-view-tab[data-view="guidance"]').click();

    // Push guidance first
    const guidanceEditor = teacherPage.locator('#guidance-editor');
    await expect(guidanceEditor).toBeVisible({ timeout: 5000 });
    await guidanceEditor.fill('Some guidance');
    await teacherPage.click('#btn-guidance-push');

    // Verify guidance banner appears
    await expect(studentPage.locator('.guidance-banner')).toBeVisible({ timeout: 5000 });

    // Now push a new problem (using push-to-student button)
    const pushSelect = teacherPage.locator('#push-problem-select');
    await pushSelect.selectOption({ index: 1 }); // Select first available problem
    await teacherPage.click('#btn-push-to-student');

    // Guidance banner should be gone after problem switch
    await expect(studentPage.locator('.guidance-banner')).not.toBeVisible({ timeout: 5000 });
  });
});
