import type { Aircraft, Clearance, PilotReadback } from '../domain/types';
import { readback } from './commands';
export function pilotResponse(a: Aircraft, c: Clearance, tick: number): PilotReadback {
  if (a.communication === 'FAILED')
    return { clearanceId: c.id, state: 'UNABLE', text: `${a.callsign}: no radio response.`, tick };
  if (
    a.emergency.kind === 'PERFORMANCE' &&
    ['CLIMB', 'DESCEND', 'LEVEL'].includes(c.kind) &&
    typeof c.value === 'number' &&
    c.value > a.requestedAltitudeFt
  )
    return {
      clearanceId: c.id,
      state: 'UNABLE',
      text: `${a.callsign}, unable requested level due performance.`,
      tick,
    };
  return {
    clearanceId: c.id,
    state: 'CORRECT',
    text: readback(a, { callsign: a.callsign, kind: c.kind, value: c.value }),
    tick,
  };
}
