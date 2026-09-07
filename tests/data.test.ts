import { expect, it } from 'vitest';
import { dataset } from '../src/data';
import { validateDataset } from '../src/data/validation';
import { validateImport } from '../src/persistence/store';
it('bundled dataset is valid and original', () => {
  expect(() => validateDataset(dataset)).not.toThrow();
  expect(dataset.synthetic).toBe(true);
  expect(dataset.waypoints.every((w) => w.id.startsWith('SIM'))).toBe(true);
  expect(dataset.rules.some((r) => r.fidelity === 'VERIFIED')).toBe(false);
});
it('rejects missing and nonfinite data', () => {
  const d = structuredClone(dataset);
  d.waypoints[0].x = NaN;
  expect(() => validateDataset(d)).toThrow();
  expect(() => validateDataset(null as never)).toThrow();
});
it.each([
  null,
  {},
  { format: 2 },
  { format: 1, settings: { accepted: true, completed: [] }, replays: [{}] },
])('rejects malformed imports', (value) => expect(() => validateImport(value)).toThrow());
