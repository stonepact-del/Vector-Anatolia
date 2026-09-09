import type { SimulationState } from '../domain/types';

export function simulatorWorkload(s: SimulationState, sector = s.selectedSector) {
  const aircraft = s.aircraft.filter((a) => a.owner === sector || a.sectorId === sector);
  const ids = new Set(aircraft.map((a) => a.id));
  const raw =
    aircraft.filter((a) => a.owner === sector).length * 3 +
    aircraft.filter((a) =>
      [
        'APPROACHING_SECTOR',
        'HANDOFF_OFFERED',
        'AWAITING_INITIAL_CONTACT',
        'INITIAL_CONTACT',
      ].includes(a.controlState),
    ).length *
      4 +
    s.pilotRequests.filter((r) => ids.has(r.aircraftId) && r.status === 'PENDING').length * 6 +
    s.transmissions.filter(
      (t) =>
        (!t.aircraftId || ids.has(t.aircraftId)) && ['QUEUED', 'TRANSMITTING'].includes(t.status),
    ).length *
      2 +
    s.conflicts.filter((c) => c.aircraftIds.some((id) => ids.has(id))).length * 9 +
    aircraft.filter((a) => a.handoff?.state === 'REQUESTED').length * 5 +
    aircraft.filter((a) => a.nextSector && a.nextSector !== sector).length * 2 +
    aircraft.filter((a) => a.emergency.kind !== 'NONE' && !a.emergency.resolved).length * 9 +
    Math.round(s.frequencyLoad * 0.18);
  return Math.min(100, Math.round(raw));
}
