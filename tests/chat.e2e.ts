/**
 * E2E tests for the chat module.
 *
 * Run: npx playwright test
 *
 * Prerequisites:
 *   - Start the backend: cd server && npm run dev
 *   - Start the frontend: npm run dev
 *   - Or use: npx playwright test (which auto-starts both via webServer config)
 */
import { test, expect } from '@playwright/test';

test.describe('Chat Module E2E', () => {
  test('student sees chat tab after registration', async ({ page }) => {
    await page.goto('/vite-page/code.html');

    // Fill registration form
    await page.fill('#reg-name', 'Alice');
    await page.fill('#reg-student-id', 'S001');
    await page.click('#reg-submit');

    // Wait for editor to appear (lab is initialized)
    await page.waitForSelector('.cm-editor', { timeout: 10000 });

    // Chat tab bar should be visible
    const tabBar = page.locator('.chat-tab-bar');
    await expect(tabBar).toBeVisible();

    // Two tabs: output and chat
    const tabs = page.locator('.chat-tab');
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(1)).toContainText('訊息');
  });

  test('teacher sends message to student and student receives it', async ({ page, context }) => {
    // --- Student page ---
    const studentPage = await context.newPage();
    await studentPage.goto('/vite-page/code.html');
    await studentPage.fill('#reg-name', 'Bob');
    await studentPage.fill('#reg-student-id', 'S002');
    await studentPage.click('#reg-submit');
    await studentPage.waitForSelector('.cm-editor', { timeout: 10000 });

    // --- Teacher page ---
    const teacherPage = await context.newPage();
    await teacherPage.goto('/vite-page/teacher.html');

    // Auth
    await teacherPage.fill('#auth-password', 'test');
    await teacherPage.click('#auth-submit');
    await teacherPage.waitForSelector('.teacher-layout', { timeout: 10000 });

    // Select student Bob
    const bobItem = teacherPage.locator('.roster-item').filter({ hasText: 'Bob' });
    await expect(bobItem).toBeVisible({ timeout: 5000 });
    await bobItem.click();

    // Switch to chat tab on teacher side
    const teacherChatTab = teacherPage.locator('.chat-tab').filter({ hasText: '訊息' });
    await teacherChatTab.click();

    // Send a message
    await teacherPage.fill('.chat-input', 'Hello Bob, try using a loop here');
    await teacherPage.click('.chat-send-btn');

    // Message should appear in teacher's chat
    await expect(teacherPage.locator('.chat-message.mine').first()).toContainText('Hello Bob');

    // Switch to chat tab on student side
    const studentChatTab = studentPage.locator('.chat-tab').filter({ hasText: '訊息' });
    await studentChatTab.click();

    // Student should see the teacher's message
    await expect(studentPage.locator('.chat-message.theirs')).toContainText('Hello Bob', { timeout: 5000 });
  });

  test('student sends message to teacher', async ({ page, context }) => {
    // --- Student page ---
    const studentPage = await context.newPage();
    await studentPage.goto('/vite-page/code.html');
    await studentPage.fill('#reg-name', 'Charlie');
    await studentPage.fill('#reg-student-id', 'S003');
    await studentPage.click('#reg-submit');
    await studentPage.waitForSelector('.cm-editor', { timeout: 10000 });

    // --- Teacher page ---
    const teacherPage = await context.newPage();
    await teacherPage.goto('/vite-page/teacher.html');
    await teacherPage.fill('#auth-password', 'test');
    await teacherPage.click('#auth-submit');
    await teacherPage.waitForSelector('.teacher-layout', { timeout: 10000 });

    // Select student Charlie
    const charlieItem = teacherPage.locator('.roster-item').filter({ hasText: 'Charlie' });
    await expect(charlieItem).toBeVisible({ timeout: 5000 });
    await charlieItem.click();

    // Switch to chat tab on teacher side
    await teacherPage.locator('.chat-tab').filter({ hasText: '訊息' }).click();

    // Student sends message
    const studentChatTab = studentPage.locator('.chat-tab').filter({ hasText: '訊息' });
    await studentChatTab.click();
    await studentPage.fill('.chat-input', 'Teacher, I have a question');
    await studentPage.click('.chat-send-btn');

    // Student sees own message
    await expect(studentPage.locator('.chat-message.mine')).toContainText('I have a question');

    // Teacher receives student message
    await expect(teacherPage.locator('.chat-message.theirs').first()).toContainText('I have a question', { timeout: 5000 });
  });

  test('chat tab switches correctly and output still works', async ({ page }) => {
    await page.goto('/vite-page/code.html');
    await page.fill('#reg-name', 'Dave');
    await page.fill('#reg-student-id', 'S004');
    await page.click('#reg-submit');
    await page.waitForSelector('.cm-editor', { timeout: 10000 });

    // Output is visible by default
    const outputPanel = page.locator('#output-panel');
    await expect(outputPanel).toBeVisible();

    // Chat panel is hidden by default
    const chatPanel = page.locator('#chat-panel-container');
    await expect(chatPanel).toHaveClass(/hidden/);

    // Switch to chat tab
    await page.locator('.chat-tab').filter({ hasText: '訊息' }).click();

    // Chat panel visible, output hidden
    await expect(chatPanel).not.toHaveClass(/hidden/);
    await expect(outputPanel).not.toBeVisible();

    // Switch back to output tab
    await page.locator('.chat-tab').filter({ hasText: '輸出' }).click();

    // Output visible, chat hidden
    await expect(outputPanel).toBeVisible();
    await expect(chatPanel).toHaveClass(/hidden/);
  });

  test('teacher sends image to student via file chooser', async ({ page, context }) => {
    // --- Student page ---
    const studentPage = await context.newPage();
    await studentPage.goto('/vite-page/code.html');
    await studentPage.fill('#reg-name', 'Grace');
    await studentPage.fill('#reg-student-id', 'S007');
    await studentPage.click('#reg-submit');
    await studentPage.waitForSelector('.cm-editor', { timeout: 10000 });

    // --- Teacher page ---
    const teacherPage = await context.newPage();
    await teacherPage.goto('/vite-page/teacher.html');
    await teacherPage.fill('#auth-password', 'test');
    await teacherPage.click('#auth-submit');
    await teacherPage.waitForSelector('.teacher-layout', { timeout: 10000 });

    // Select student Grace
    const graceItem = teacherPage.locator('.roster-item').filter({ hasText: 'Grace' });
    await expect(graceItem).toBeVisible({ timeout: 5000 });
    await graceItem.click();

    // Switch to chat tab on teacher side
    await teacherPage.locator('.chat-tab').filter({ hasText: '訊息' }).click();

    // Upload image via file chooser
    const fileChooserPromise = teacherPage.waitForEvent('filechooser');
    await teacherPage.locator('.chat-image-btn').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles('tests/fixtures/sample.png');

    // Preview should be visible
    await expect(teacherPage.locator('.chat-image-preview')).toBeVisible({ timeout: 3000 });

    // Send with text
    await teacherPage.fill('.chat-input', 'Here is a screenshot');
    await teacherPage.click('.chat-send-btn');

    // Preview should be hidden after send
    await expect(teacherPage.locator('.chat-image-preview')).toBeHidden({ timeout: 3000 });

    // Teacher sees own message with image
    await expect(teacherPage.locator('.chat-message.mine').first()).toContainText('Here is a screenshot');
    await expect(teacherPage.locator('.chat-message.mine .chat-message-image img').first()).toBeVisible({ timeout: 3000 });

    // Student receives the image
    await studentPage.locator('.chat-tab').filter({ hasText: '訊息' }).click();
    await expect(studentPage.locator('.chat-message.theirs .chat-message-image img')).toBeVisible({ timeout: 5000 });
  });

  test('switching students on teacher side updates chat', async ({ page, context }) => {
    // Register two students
    const s1 = await context.newPage();
    await s1.goto('/vite-page/code.html');
    await s1.fill('#reg-name', 'Eve');
    await s1.fill('#reg-student-id', 'S005');
    await s1.click('#reg-submit');
    await s1.waitForSelector('.cm-editor', { timeout: 10000 });

    const s2 = await context.newPage();
    await s2.goto('/vite-page/code.html');
    await s2.fill('#reg-name', 'Frank');
    await s2.fill('#reg-student-id', 'S006');
    await s2.click('#reg-submit');
    await s2.waitForSelector('.cm-editor', { timeout: 10000 });

    // Teacher
    const teacherPage = await context.newPage();
    await teacherPage.goto('/vite-page/teacher.html');
    await teacherPage.fill('#auth-password', 'test');
    await teacherPage.click('#auth-submit');
    await teacherPage.waitForSelector('.teacher-layout', { timeout: 10000 });

    // Select Eve first (chat tab only appears after selecting a student)
    const eveItem = teacherPage.locator('.roster-item').filter({ hasText: 'Eve S005' });
    await expect(eveItem).toBeVisible({ timeout: 5000 });
    await eveItem.click();

    // Switch to chat tab
    await teacherPage.locator('.chat-tab').filter({ hasText: '訊息' }).click();
    await teacherPage.fill('.chat-input', 'Message for Eve');
    await teacherPage.click('.chat-send-btn');
    await expect(teacherPage.locator('.chat-message.mine').first()).toContainText('Message for Eve');
    // Switch to Frank - chat should reset
    const frankItem = teacherPage.locator('.roster-item').filter({ hasText: 'Frank' });
    await expect(frankItem).toBeVisible({ timeout: 5000 });
    await frankItem.click();

    // Should show empty state for new conversation (no messages from Eve)
    await expect(teacherPage.locator('.chat-message')).toHaveCount(0, { timeout: 3000 });
  });
});
