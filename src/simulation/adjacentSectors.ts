import type { Aircraft, SimulationState } from '../domain/types';
import { queueTransmission } from './communications';
import { event } from './events';

export function updateAdjacentSectors(s: SimulationState) {
  for (const adjacent of s.adjacentSectors) {
    const traffic = s.aircraft.filter((a) => a.sectorId === adjacent.sectorId).length;
    const conflicts = s.conflicts.filter((c) =>
      c.aircraftIds.some((id) =>
        s.aircraft.some((a) => a.id === id && a.sectorId === adjacent.sectorId),
      ),
    ).length;
    adjacent.pendingInbound = s.aircraft.filter(
      (a) => a.handoff?.to === adjacent.sectorId && a.handoff.state === 'REQUESTED',
    ).length;
    adjacent.pendingOutbound = s.aircraft.filter(
      (a) => a.nextSector === adjacent.sectorId && s.combinedSectors.includes(a.owner ?? ''),
    ).length;
    adjacent.workload = Math.min(100, traffic * 5 + conflicts * 12 + adjacent.pendingInbound * 7);
    adjacent.frequencyLoad = Math.min(100, traffic * 4 + adjacent.pendingInbound * 6);
    adjacent.configuration = s.combinedSectors.includes(adjacent.sectorId) ? 'COMBINED' : 'OPEN';
  }
}

export function coordinationDelay(s: SimulationState, sectorId: string) {
  const adjacent = s.adjacentSectors.find((x) => x.sectorId === sectorId);
  const load = adjacent?.workload ?? 25;
  return 16 + Math.floor(load / 8) * 4;
}

export function offerOutbound(s: SimulationState, a: Aircraft, target: string) {
  const delay = coordinationDelay(s, target);
  a.handoff = {
    from: a.owner,
    to: target,
    state: 'REQUESTED',
    initiatedTick: s.clock.tick,
    availableTick: s.clock.tick + delay,
    reason: delay >= 44 ? 'Receiving sector workload is high.' : 'Coordination in progress.',
  };
  a.controlState = 'OUTBOUND_COORDINATION';
  queueTransmission(s, {
    aircraftId: a.id,
    speaker: 'SYSTEM',
    type: 'COORDINATION',
    text: `${a.callsign} offered to ${target}.`,
    priority: 'ATTENTION',
  });
}

export function stepCoordination(s: SimulationState) {
  for (const a of s.aircraft) {
    if (
      a.controlState === 'CONTROLLED' &&
      !s.combinedSectors.includes(a.owner ?? '') &&
      s.combinedSectors.includes(a.nextSector ?? '')
    ) {
      a.controlState = 'APPROACHING_SECTOR';
      a.handoff = {
        from: a.owner,
        to: a.nextSector!,
        state: 'NONE',
        initiatedTick: s.clock.tick,
        reason: 'Advance notification from the adjacent sector.',
      };
      event(s, 'ADVANCE_NOTICE', `${a.callsign} is approaching ${a.nextSector}.`, a.id);
    }
    if (
      a.controlState === 'APPROACHING_SECTOR' &&
      a.handoff?.state === 'NONE' &&
      s.clock.tick - a.handoff.initiatedTick >= 12
    ) {
      a.controlState = 'HANDOFF_OFFERED';
      a.handoff.state = 'REQUESTED';
      queueTransmission(s, {
        aircraftId: a.id,
        speaker: 'SYSTEM',
        type: 'HANDOFF',
        text: `Inbound handoff offered: ${a.callsign} from ${a.handoff.from ?? 'adjacent sector'}.`,
        priority: 'ATTENTION',
      });
      event(s, 'INBOUND', `${a.callsign} offered inbound to ${a.handoff.to}.`, a.id);
    }
    if (
      a.handoff?.state !== 'REQUESTED' ||
      !a.handoff.availableTick ||
      s.clock.tick < a.handoff.availableTick
    )
      continue;
    a.handoff.state = 'AGREED';
    a.handoff.acceptedTick = s.clock.tick;
    a.controlState = 'TRANSFER_ACCEPTED';
    s.metrics.handoffDelayTicks += s.clock.tick - a.handoff.initiatedTick;
    queueTransmission(s, {
      aircraftId: a.id,
      speaker: 'SYSTEM',
      type: 'COORDINATION',
      text: `${a.handoff.to} accepts ${a.callsign}. Contact may be instructed.`,
      priority: 'ATTENTION',
    });
    event(s, 'COORDINATION', `${a.handoff.to} accepted ${a.callsign}.`, a.id);
  }
}
