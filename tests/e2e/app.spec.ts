import { test, expect } from '@playwright/test';
test('tutorial control cycle, pause, report, persistence and replay', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your airspace.' })).toBeVisible();
  await page.getByRole('button', { name: 'BEGIN GUIDED SESSION' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.locator('.flight-row').filter({ hasText: 'THY' }).first().click();
  await page.getByRole('button', { name: 'ACCEPT', exact: true }).click();
  await expect(page.getByRole('button', { name: 'IDENTIFY', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'IDENTIFY', exact: true }).click();
  await expect(page.locator('.tutorial h3')).toHaveText('Issue a level clearance');
  await page.getByRole('button', { name: '4×', exact: true }).click();
  await page.getByRole('button', { name: 'LEVEL', exact: false }).filter({ hasText: '⌃' }).click();
  await page.getByRole('button', { name: 'FL370', exact: true }).click();
  await expect(page.locator('.tutorial h3')).toHaveText('Shorten the route');
  await page.getByRole('button', { name: 'DIRECT', exact: false }).filter({ hasText: '⌃' }).click();
  await page.getByRole('button', { name: 'SIMCA', exact: true }).click();
  await expect(page.locator('.tutorial h3')).toHaveText('Coordinate and transfer');
  await page
    .getByRole('button', { name: 'TRANSFER', exact: false })
    .filter({ hasText: '⌃' })
    .click();
  await page.getByRole('button', { name: 'S3 / CENTRAL', exact: true }).click();
  await page.getByRole('button', { name: 'CONTACT', exact: true }).click();
  await expect(page.locator('.tutorial h3')).toHaveText('Orientation complete');
  await page.getByRole('button', { name: 'Pause simulation' }).click();
  const clock = await page.locator('.clock strong').textContent();
  await page.waitForTimeout(700);
  expect(await page.locator('.clock strong').textContent()).toBe(clock);
  await page.getByRole('button', { name: 'NETWORK', exact: true }).click();
  await expect(page.locator('.network-picker')).toBeVisible();
  await page.screenshot({ path: 'artifacts/network-1440.png' });
  await page.getByRole('button', { name: 'END SHIFT' }).click();
  await expect(page.locator('.report')).toBeVisible();
  await expect(page.locator('.report')).toContainText('Good / missed handoffs');
  await page.getByRole('button', { name: 'REPLAY LIBRARY', exact: true }).click();
  await expect(page.locator('.replay-row')).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: 'REPLAYS ↗', exact: true }).click();
  await expect(page.locator('.replay-row')).toHaveCount(1);
  await page.locator('.replay-row').click();
  await expect(page.getByRole('slider', { name: 'Replay seek' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('conflict scenario, command syntax feedback and viewport layouts', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('PRACTICE ALL SCENARIOS').check();
  await page.getByRole('button', { name: /TRANSIT WAVE/ }).click();
  await page.getByRole('button', { name: 'BEGIN SHIFT' }).click();
  await page.getByRole('button', { name: '4×', exact: true }).click();
  await page.getByLabel('Command entry').fill('THY FAKE');
  await page.getByLabel('Command entry').press('Enter');
  await expect(page.getByRole('status')).toContainText('Unknown syntax');
  await expect(page.locator('.safety-alert').first()).toBeVisible({ timeout: 30000 });
  for (const [width, height] of [
    [1366, 768],
    [1920, 1080],
    [1024, 768],
  ]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `artifacts/radar-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.getByRole('button', { name: 'END SHIFT' }).click();
  await expect(page.locator('.report')).toBeVisible();
});
test('medical scenario produces an actionable abnormal state', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('PRACTICE ALL SCENARIOS').check();
  await page.getByRole('button', { name: /MEDICAL DIVERSION/ }).click();
  await page.getByRole('button', { name: 'BEGIN SHIFT' }).click();
  await page.getByRole('button', { name: '4×', exact: true }).click();
  await page.locator('.flight-row').filter({ hasText: 'THY' }).first().click();
  await expect(page.locator('.abnormal-box')).toContainText('MEDICAL', { timeout: 20000 });
  await page.getByRole('button', { name: 'ACKNOWLEDGE', exact: true }).click();
  await expect(page.locator('.abnormal-box')).toContainText('Acknowledged');
});
