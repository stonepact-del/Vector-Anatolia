import type { Aircraft, Clearance, PilotReadback } from '../domain/types';
import { readback } from './commands';
export function pilotResponse(a: Aircraft, c: Clearance, tick: number): PilotReadback {
  if (a.communication === 'FAILED')
    return { clearanceId: c.id, state: 'UNABLE', text: `${a.callsign}: no radio response.`, tick };
  return {
    clearanceId: c.id,
    state: 'CORRECT',
    text: readback(a, { callsign: a.callsign, kind: c.kind, value: c.value }),
    tick,
  };
}
