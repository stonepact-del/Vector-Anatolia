import { expect, it } from 'vitest';
import { createState, step } from '../src/simulation/engine';
import { predictConflicts } from '../src/simulation/conflicts';
import { dataset } from '../src/data';
it('benchmarks prediction at 50, 100, 200 and 300 aircraft', () => {
  const s = createState();
  const template = s.aircraft[1];
  const fleet = Array.from({ length: 300 }, (_, i) => ({
    ...structuredClone(template),
    id: `AC${String(i).padStart(5, '0')}`,
    callsign: `SIM${i}`,
    position: { x: 15 + (i % 30) * 26, y: 15 + Math.floor(i / 30) * 36 },
    altitudeFt: 31000 + (i % 5) * 2000,
    clearedAltitudeFt: 31000 + (i % 5) * 2000,
  }));
  const timings = [50, 100, 200, 300].map((count) => {
    s.aircraft = fleet.slice(0, count);
    const start = performance.now();
    const conflicts = predictConflicts(s.aircraft, dataset);
    return { count, ms: Math.round(performance.now() - start), conflicts: conflicts.length };
  });
  s.aircraft = fleet;
  const stepStart = performance.now();
  for (let i = 0; i < 4; i++) step(s);
  const stepMs = performance.now() - stepStart;
  console.log(
    JSON.stringify({
      benchmark: 'Living Airspace predictor',
      timings,
      oneSimSecondMs: Math.round(stepMs),
    }),
  );
  expect(s.aircraft).toHaveLength(300);
  expect(timings.at(-1)!.ms).toBeLessThan(4000);
  expect(s.aircraft.every((a) => Number.isFinite(a.position.x))).toBe(true);
});
