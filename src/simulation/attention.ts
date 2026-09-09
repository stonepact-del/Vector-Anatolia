import type { AttentionItem, SimulationState } from '../domain/types';

export function buildAttention(s: SimulationState): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const alert of s.alerts)
    items.push({
      id: `AL-${alert.id}`,
      aircraftId: alert.aircraftIds[0],
      kind: 'SAFETY',
      priority: 100,
      createdTick: alert.startedTick,
      label: alert.actual ? 'SEPARATION LOSS' : 'SAFETY NET',
      detail: alert.aircraftIds
        .map((id) => s.aircraft.find((a) => a.id === id)?.callsign)
        .join(' / '),
    });
  for (const a of s.aircraft) {
    if (!s.combinedSectors.includes(a.sectorId) && !s.combinedSectors.includes(a.owner ?? ''))
      continue;
    if (a.emergency.kind !== 'NONE' && !a.emergency.acknowledged)
      items.push({
        id: `EM-${a.id}`,
        aircraftId: a.id,
        kind: 'ABNORMAL',
        priority: 90,
        createdTick: a.emergency.declaredTick,
        label: a.emergency.kind,
        detail: a.callsign,
      });
    if (a.controlState === 'HANDOFF_OFFERED')
      items.push({
        id: `IN-${a.id}`,
        aircraftId: a.id,
        kind: 'INBOUND_HANDOFF',
        priority: 55,
        createdTick: a.enteredTick,
        label: 'INBOUND HANDOFF',
        detail: a.callsign,
      });
    if (a.controlState === 'INITIAL_CONTACT')
      items.push({
        id: `IC-${a.id}`,
        aircraftId: a.id,
        kind: 'INITIAL_CALL',
        priority: 65,
        createdTick: a.lastCommunicationTick,
        label: 'INITIAL CALL',
        detail: a.callsign,
      });
    if (a.controlState === 'TRANSFER_ACCEPTED')
      items.push({
        id: `OT-${a.id}`,
        aircraftId: a.id,
        kind: 'OUTBOUND_TRANSFER',
        priority: 45,
        createdTick: a.handoff?.acceptedTick ?? s.clock.tick,
        label: 'TRANSFER ACCEPTED',
        detail: `${a.callsign} → ${a.handoff?.to}`,
      });
    if (a.controlState === 'OUTBOUND_COORDINATION')
      items.push({
        id: `CO-${a.id}`,
        aircraftId: a.id,
        kind: 'COORDINATION',
        priority: 30,
        createdTick: a.handoff?.initiatedTick ?? s.clock.tick,
        label: 'COORDINATION',
        detail: `${a.callsign} · ${a.handoff?.reason ?? 'pending'}`,
      });
  }
  for (const r of s.pilotRequests.filter((r) => r.status === 'PENDING')) {
    const a = s.aircraft.find((a) => a.id === r.aircraftId);
    items.push({
      id: r.id,
      aircraftId: r.aircraftId,
      kind: 'PILOT_REQUEST',
      priority: r.priority === 'URGENT' ? 85 : 60,
      createdTick: r.createdTick,
      label: `${r.kind} REQUEST`,
      detail: a?.callsign ?? r.aircraftId,
    });
  }
  for (const readback of s.readbacks.filter(
    (r) =>
      r.state === 'CLARIFY' &&
      !s.readbacks.some(
        (other) =>
          other.clearanceId === r.clearanceId &&
          other.tick > r.tick &&
          ['CORRECT', 'CORRECTED'].includes(other.state),
      ),
  )) {
    const command = s.commands.find((c) => c.id === readback.clearanceId);
    const a = s.aircraft.find((a) => a.id === command?.aircraftId);
    items.push({
      id: `RB-${readback.clearanceId}`,
      aircraftId: a?.id,
      kind: 'READBACK',
      priority: 75,
      createdTick: readback.tick,
      label: 'READBACK ISSUE',
      detail: a?.callsign ?? readback.clearanceId,
    });
  }
  return items.sort(
    (a, b) => b.priority - a.priority || a.createdTick - b.createdTick || a.id.localeCompare(b.id),
  );
}
