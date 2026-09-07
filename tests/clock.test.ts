import { expect, it } from 'vitest';
import { FixedStepScheduler } from '../src/simulation/clock';
import { pilotResponse } from '../src/simulation/pilot';
import { createState, issueCommand } from '../src/simulation/engine';
it('render frequencies produce identical step counts for identical elapsed time', () => {
  for (const fps of [30, 60, 120, 144]) {
    const clock = new FixedStepScheduler();
    let ticks = 0;
    for (let f = 0; f < fps * 10; f++)
      clock.advance(1 / fps, 1, false, () => {
        ticks++;
      });
    expect(ticks).toBe(40);
  }
});
it('pause resets backlog and speed affects tick count only', () => {
  const c = new FixedStepScheduler();
  let ticks = 0;
  c.advance(0.2, 1, false, () => {
    ticks++;
  });
  c.advance(0.5, 4, true, () => {
    ticks++;
  });
  expect(ticks).toBe(0);
  c.advance(0.25, 4, false, () => {
    ticks++;
  });
  expect(ticks).toBe(4);
  c.advance(0.5, 0.5, false, () => {
    ticks++;
  });
  expect(ticks).toBe(5);
});
it('rejects invalid elapsed values', () =>
  expect(() => new FixedStepScheduler().advance(NaN, 1, false, () => {})).toThrow());
it('pilot unable and correct responses are deterministic', () => {
  const s = createState(),
    a = s.aircraft[0];
  const result = issueCommand(s, { callsign: a.callsign, kind: 'ACCEPT' });
  if (!result.ok) throw Error(result.error);
  expect(pilotResponse(a, result.command, 1)).toEqual(pilotResponse(a, result.command, 1));
  a.communication = 'FAILED';
  expect(pilotResponse(a, result.command, 1).state).toBe('UNABLE');
});
