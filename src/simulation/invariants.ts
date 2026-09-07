import type { SimulationState } from '../domain/types';
export function assertState(s: SimulationState) {
  const ids = new Set<string>();
  for (const a of s.aircraft) {
    if (ids.has(a.id)) throw Error('Duplicate aircraft identity.');
    ids.add(a.id);
    if (
      ![
        a.position.x,
        a.position.y,
        a.altitudeFt,
        a.clearedAltitudeFt,
        a.headingDeg,
        a.trackDeg,
        a.tasKt,
        a.iasKt,
        a.mach,
      ].every(Number.isFinite)
    )
      throw Error(`Invalid numeric state for ${a.callsign}.`);
    if (a.owner !== null && typeof a.owner !== 'string')
      throw Error(`Invalid ownership for ${a.callsign}.`);
  }
  if (!Number.isSafeInteger(s.clock.tick) || s.clock.tick < 0)
    throw Error('Invalid simulation tick.');
}
