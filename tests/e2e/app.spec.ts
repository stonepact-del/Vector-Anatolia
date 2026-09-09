import { test, expect } from '@playwright/test';
const runtimeErrors = new WeakMap<object, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page) ?? []).toEqual([]);
});
test('tutorial control cycle, pause, report, persistence and replay', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your airspace.' })).toBeVisible();
  await page.getByRole('button', { name: 'BEGIN GUIDED SESSION' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.locator('.flight-row').filter({ hasText: 'THY' }).first().click();
  await page.getByRole('button', { name: 'ACCEPT', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'IDENTIFY', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'IDENTIFY', exact: true }).click();
  await expect(page.locator('.tutorial h3')).toHaveText('Issue a level clearance');
  await page.getByRole('button', { name: '4×', exact: true }).click();
  await page.getByRole('button', { name: 'LEVEL', exact: false }).filter({ hasText: '⌃' }).click();
  await page.getByRole('button', { name: 'FL370', exact: true }).click();
  await expect(page.locator('.tutorial h3')).toHaveText('Shorten the route');
  await page.getByRole('button', { name: 'DIRECT', exact: false }).filter({ hasText: '⌃' }).click();
  await page.getByRole('button', { name: 'SIMCA', exact: true }).click();
  await expect(page.locator('.tutorial h3')).toHaveText('Listen for a request');
  await expect(page.getByRole('button', { name: 'APPROVE REQUEST' })).toBeVisible();
  await expect(page.locator('.communications')).toContainText('request flight level');
  await page.getByRole('button', { name: 'APPROVE REQUEST' }).click();
  await expect(page.locator('.tutorial h3')).toHaveText('Monitor the result');
  await expect(page.locator('.tutorial h3')).toHaveText('Coordinate outbound', { timeout: 10000 });
  const callsign = (await page.locator('.command-aircraft strong').textContent())!;
  await page.getByLabel('Command entry').fill(`${callsign} SPEED M078`);
  await page.getByLabel('Command entry').press('Enter');
  await expect(page.locator('.history-row').filter({ hasText: 'MACH' })).toContainText('EXECUTED');
  await page
    .getByRole('button', { name: 'TRANSFER', exact: false })
    .filter({ hasText: '⌃' })
    .click();
  await page.getByRole('button', { name: 'S3 / CENTRAL', exact: true }).click();
  await expect(page.locator('.attention-panel')).toContainText('TRANSFER ACCEPTED');
  await page.getByRole('button', { name: 'CONTACT', exact: true }).click();
  await expect(page.locator('.tutorial h3')).toHaveText('Control cycle complete');
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
  await expect(page.locator('.report')).toContainText('Peak radio load');
  await page.getByRole('button', { name: 'REPLAY LIBRARY', exact: true }).click();
  await expect(page.locator('.replay-row')).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: 'REPLAYS ↗', exact: true }).click();
  await expect(page.locator('.replay-row')).toHaveCount(1);
  await page.locator('.replay-row').click();
  const seek = page.getByRole('slider', { name: 'Replay seek' });
  await expect(seek).toBeVisible();
  await seek.fill((await seek.getAttribute('max'))!);
  await expect(page.locator('.replay-bar span')).not.toHaveText('00:00');
  await seek.fill('0');
  await expect(page.locator('.replay-bar span')).toHaveText('00:00');
  await page.getByRole('button', { name: 'Resume simulation' }).click();
  await expect(page.locator('.replay-bar span')).not.toHaveText('00:00');
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
  const conflictCallsign = (
    (await page.locator('.safety-alert small').first().textContent()) ?? ''
  ).split(' / ')[0];
  await page.locator('.flight-row').filter({ hasText: conflictCallsign }).first().click();
  await page.getByRole('button', { name: 'LEVEL', exact: false }).filter({ hasText: '⌃' }).click();
  await page.getByRole('button', { name: 'FL330', exact: true }).click();
  await expect(
    page
      .locator('.history-row')
      .filter({ hasText: /CLIMB|DESCEND|LEVEL/ })
      .first(),
  ).toContainText('EXECUTED');
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
  await expect(page.locator('.abnormal-box')).toContainText(
    /Acknowledged|Deviation \/ diversion clearance received/,
  );
});

test('weather proximity creates an active pilot request', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('PRACTICE ALL SCENARIOS').check();
  await page.getByRole('button', { name: /THUNDERSTORM DEVIATIONS/ }).click();
  await page.getByRole('button', { name: 'BEGIN SHIFT' }).click();
  await page.getByRole('button', { name: '4×', exact: true }).click();
  await page.locator('.flight-row').filter({ hasText: 'THY' }).first().click();
  await page.getByRole('button', { name: 'ACCEPT', exact: true }).click();
  await page.getByRole('button', { name: 'IDENTIFY', exact: true }).click();
  await expect(page.locator('.request-box')).toContainText('WEATHER REQUEST', { timeout: 25000 });
  await page.getByRole('button', { name: 'APPROVE REQUEST' }).click();
  await expect(page.locator('.abnormal-box')).toContainText(
    /Acknowledged|Deviation \/ diversion clearance received/,
  );
});

test('local settings survive reload and malformed import recovers safely', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'BEGIN GUIDED SESSION' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Reduced motion').check();
  await page.getByLabel('Aircraft labels', { exact: true }).uncheck();
  await page.reload();
  await page.getByRole('button', { name: 'BEGIN GUIDED SESSION' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Reduced motion')).toBeChecked();
  await expect(page.getByLabel('Aircraft labels', { exact: true })).not.toBeChecked();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":1,"settings":null,"replays":[]}'),
  });
  await expect(page.getByRole('alert')).toContainText('Invalid export format');
  await page.getByRole('button', { name: 'Dismiss error' }).click();
  await expect(page.getByLabel('Reduced motion')).toBeChecked();
  await page.getByRole('button', { name: 'BACK', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
});
