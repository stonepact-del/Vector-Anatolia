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

import { createState, makeReplay, finishShift, replayTo } from '../src/simulation/engine';
import { validateReplay } from '../src/persistence/validation';
import { defaults } from '../src/persistence/store';
it('validates genuine exports and replay action order', () => {
  const s = createState(),
    initial = structuredClone(s);
  finishShift(s);
  const r = makeReplay(initial, s);
  expect(() => validateReplay(r)).not.toThrow();
  expect(() => validateImport({ format: 1, settings: defaults, replays: [r] })).not.toThrow();
  r.actions[0].sequence = 3;
  expect(() => validateReplay(r)).toThrow('order');
});
it('rejects invalid settings before replacement', () => {
  expect(() =>
    validateImport({ format: 1, settings: { ...defaults, bests: null }, replays: [] }),
  ).toThrow('settings');
});
it('detects altered replay output', () => {
  const s = createState(),
    initial = structuredClone(s);
  finishShift(s);
  const r = makeReplay(initial, s);
  r.finalHash = 'wrong';
  expect(() => replayTo(r)).toThrow('integrity');
});

import { step, stateHash } from '../src/simulation/engine';
it('runs and replays a replacement dataset without Ankara-specific engine identifiers', () => {
  const d = structuredClone(dataset);
  d.id = 'REPLACEMENT';
  d.version = 'alternate-v1';
  d.contentHash = 'replacement-fixture';
  const rename = (id: string) => `ALT-${id}`;
  for (const sec of d.sectors) {
    sec.id = rename(sec.id);
    sec.adjacent = sec.adjacent.map(rename);
    sec.center.x += 1000;
    sec.center.y += 500;
    sec.polygon = sec.polygon.map((p) => ({ x: p.x + 1000, y: p.y + 500 }));
  }
  for (const w of d.waypoints) {
    w.id = rename(w.id);
    w.x += 1000;
    w.y += 500;
  }
  for (const flow of d.trafficFlows) flow.routes = flow.routes.map((r) => r.map(rename));
  d.simulation.initialSector = rename(d.simulation.initialSector);
  d.simulation.medicalFix = rename(d.simulation.medicalFix);
  for (const o of d.simulation.orientationFlights) {
    o.route = o.route.map(rename);
    o.position.x += 1000;
    o.position.y += 500;
  }
  d.simulation.bounds = { minX: 1000, minY: 500, maxX: 1800, maxY: 880 };
  const s = createState(undefined, 55, 1, 30, d),
    initial = structuredClone(s);
  for (let i = 0; i < 4; i++) step(s);
  expect(s.aircraft[0].position.x).toBeGreaterThan(1000);
  expect(s.selectedSector).toBe('ALT-S2');
  const replay = makeReplay(initial, s);
  expect(stateHash(replayTo(replay))).toBe(stateHash(s));
});
