import { test, expect } from '@playwright/test';
test('production precaches every gameplay dependency and runs offline', async ({
  page,
  context,
}) => {
  const external: string[] = [];
  const errors: string[] = [];
  const failures: string[] = [];
  page.on('requestfailed', (r) => failures.push(`${r.url()} ${r.failure()?.errorText}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
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
  await expect(page.getByRole('button', { name: 'BEGIN GUIDED SESSION' }))
    .toBeVisible()
    .catch(async (error) => {
      console.log({
        errors,
        failures,
        html: await page.content(),
        cache: await page.evaluate(async () => {
          const keys = await caches.keys();
          return Promise.all(
            keys.map(async (k) => ({
              key: k,
              requests: (await (await caches.open(k)).keys()).map((r) => r.url),
            })),
          );
        }),
      });
      throw error;
    });
  await page.getByRole('button', { name: 'BEGIN GUIDED SESSION' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.clock strong')).not.toHaveText('12:00:00');
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
