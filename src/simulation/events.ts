import type { SimulationState } from '../domain/types';
export function event(
  s: SimulationState,
  type: string,
  message: string,
  aircraftId?: string,
  severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO',
) {
  s.events.push({ id: s.nextEventId++, tick: s.clock.tick, type, message, aircraftId, severity });
}
