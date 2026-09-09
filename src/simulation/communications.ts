import type {
  CommunicationPriority,
  SimulationState,
  Transmission,
  TransmissionType,
} from '../domain/types';

const priorityRank: Record<CommunicationPriority, number> = {
  SAFETY: 4,
  URGENT: 3,
  ATTENTION: 2,
  ROUTINE: 1,
};

export function queueTransmission(
  s: SimulationState,
  input: {
    aircraftId?: string;
    speaker: Transmission['speaker'];
    type: TransmissionType;
    text: string;
    priority?: CommunicationPriority;
    delayTicks?: number;
    durationTicks?: number;
    meaning?: string;
  },
) {
  const transmission: Transmission = {
    id: `TX${s.nextTransmissionId++}`,
    aircraftId: input.aircraftId,
    speaker: input.speaker,
    type: input.type,
    createdTick: s.clock.tick,
    availableTick: s.clock.tick + (input.delayTicks ?? 0),
    durationTicks: input.durationTicks ?? Math.max(5, Math.ceil(input.text.length / 9)),
    priority: input.priority ?? 'ROUTINE',
    text: input.text,
    status: 'QUEUED',
    meaning: input.meaning,
  };
  s.transmissions.push(transmission);
  return transmission;
}

export function stepRadio(s: SimulationState) {
  const active = s.transmissions.find((t) => t.status === 'TRANSMITTING');
  if (active && s.clock.tick >= active.availableTick + active.durationTicks) {
    active.status = 'COMPLETE';
    s.metrics.transmissions++;
  }
  if (!s.transmissions.some((t) => t.status === 'TRANSMITTING')) {
    const next = s.transmissions
      .filter((t) => t.status === 'QUEUED' && t.availableTick <= s.clock.tick)
      .sort(
        (a, b) =>
          priorityRank[b.priority] - priorityRank[a.priority] ||
          a.availableTick - b.availableTick ||
          a.id.localeCompare(b.id),
      )[0];
    if (next) {
      next.status = 'TRANSMITTING';
      next.availableTick = s.clock.tick;
    }
  }
  const windowStart = s.clock.tick - 240;
  const occupied = s.transmissions
    .filter((t) => t.status === 'COMPLETE' && t.availableTick + t.durationTicks > windowStart)
    .reduce(
      (sum, t) => sum + Math.min(t.durationTicks, t.availableTick + t.durationTicks - windowStart),
      0,
    );
  const current = s.transmissions.find((t) => t.status === 'TRANSMITTING');
  const live = current
    ? Math.min(current.durationTicks, s.clock.tick - current.availableTick + 1)
    : 0;
  const backlog = s.transmissions.filter((t) => t.status === 'QUEUED').length;
  s.frequencyLoad = Math.min(100, Math.round(((occupied + live) / 240) * 100 + backlog * 2));
  s.metrics.peakFrequencyLoad = Math.max(s.metrics.peakFrequencyLoad, s.frequencyLoad);
  if (s.transmissions.length > 300) {
    const live = s.transmissions.filter((t) => t.status !== 'COMPLETE');
    const recent = s.transmissions.filter((t) => t.status === 'COMPLETE').slice(-180);
    s.transmissions = [...recent, ...live].sort(
      (a, b) => a.createdTick - b.createdTick || a.id.localeCompare(b.id),
    );
  }
}

export function radioDelay(s: SimulationState, priority: CommunicationPriority = 'ROUTINE') {
  const queue = s.transmissions.filter((t) => t.status === 'QUEUED').length;
  return priority === 'SAFETY' ? 0 : Math.round(queue * 2 + s.frequencyLoad / 12);
}
