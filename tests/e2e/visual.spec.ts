import { test, expect } from '@playwright/test';
test('briefing, selected command panel and report remain visually coherent', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'BEGIN GUIDED SESSION' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/briefing-1440.png' });
  await page.getByRole('button', { name: 'BEGIN GUIDED SESSION' }).click();
  await page.locator('.flight-row').filter({ hasText: 'THY' }).first().click();
  await page.getByRole('button', { name: 'ACCEPT', exact: true }).click();
  await page.getByRole('button', { name: 'IDENTIFY', exact: true }).click();
  await expect(page.locator('.tutorial h3')).toHaveText('Issue a level clearance');
  await page.getByRole('button', { name: 'LEVEL', exact: false }).filter({ hasText: '⌃' }).click();
  await expect(page.locator('.command-popover')).toBeVisible();
  await page.screenshot({ path: 'artifacts/selected-1440.png' });
  await page.getByRole('button', { name: 'FL350', exact: true }).click();
  await page.getByRole('button', { name: 'END SHIFT' }).click();
  await expect(page.locator('.report')).toBeVisible();
  await page.screenshot({ path: 'artifacts/report-1440.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
