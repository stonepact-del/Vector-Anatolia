import { test, expect } from '@playwright/test';
test('production precaches every gameplay dependency and runs offline', async ({
  page,
  context,
}) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('request', (r) => {
    if (
      !r.url().startsWith('http://127.0.0.1:4174') &&
      !r.url().startsWith('blob:') &&
      !r.url().startsWith('data:')
    )
      external.push(r.url());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'BEGIN GUIDED SESSION' })).toBeVisible();
  await page.getByRole('button', { name: 'BEGIN GUIDED SESSION' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.clock strong')).not.toHaveText('12:00:00');
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
