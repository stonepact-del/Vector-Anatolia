import { expect, it } from 'vitest';
import { createState, step } from '../src/simulation/engine';
import { predictConflicts } from '../src/simulation/conflicts';
import { dataset } from '../src/data';
it('benchmarks 300 aircraft with prediction enabled', () => {
  const s = createState();
  const template = s.aircraft[1];
  s.aircraft = Array.from({ length: 300 }, (_, i) => ({
    ...structuredClone(template),
    id: `AC${String(i).padStart(5, '0')}`,
    callsign: `SIM${i}`,
    position: { x: 15 + (i % 30) * 26, y: 15 + Math.floor(i / 30) * 36 },
    altitudeFt: 31000 + (i % 5) * 2000,
    clearedAltitudeFt: 31000 + (i % 5) * 2000,
  }));
  const start = performance.now();
  const conflicts = predictConflicts(s.aircraft, dataset);
  const ms = performance.now() - start;
  const stepStart = performance.now();
  for (let i = 0; i < 4; i++) step(s);
  const stepMs = performance.now() - stepStart;
  console.log(
    JSON.stringify({
      benchmark: '300 aircraft',
      predictionMs: Math.round(ms),
      oneSimSecondMs: Math.round(stepMs),
      conflicts: conflicts.length,
    }),
  );
  expect(s.aircraft).toHaveLength(300);
  expect(ms).toBeLessThan(8000);
  expect(s.aircraft.every((a) => Number.isFinite(a.position.x))).toBe(true);
});
