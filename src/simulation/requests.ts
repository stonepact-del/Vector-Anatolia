import type { Aircraft, PilotRequest, PilotRequestKind, SimulationState } from '../domain/types';
import { queueTransmission, radioDelay } from './communications';
import { distance } from './math';
import { event } from './events';

function createRequest(
  s: SimulationState,
  a: Aircraft,
  kind: PilotRequestKind,
  value: number | string | undefined,
  reason: string,
  priority: PilotRequest['priority'] = 'ROUTINE',
) {
  if (
    s.pilotRequests.some(
      (r) => r.aircraftId === a.id && ['QUEUED', 'TRANSMITTED', 'PENDING'].includes(r.status),
    )
  )
    return;
  const request: PilotRequest = {
    id: `RQ${s.nextRequestId++}`,
    aircraftId: a.id,
    kind,
    value,
    createdTick: s.clock.tick,
    status: 'QUEUED',
    reason,
    priority,
  };
  s.pilotRequests.push(request);
  s.metrics.pilotRequests++;
  a.controlState = 'REQUEST_PENDING';
  const text =
    kind === 'HIGHER'
      ? `${a.callsign}, request flight level ${Number(value) / 100}.`
      : kind === 'WEATHER'
        ? `${a.callsign}, request deviation due weather.`
        : kind === 'RETURN_ROUTE'
          ? `${a.callsign}, request return to route.`
          : kind === 'DIVERSION'
            ? `${a.callsign}, request diversion via ${value}.`
            : `${a.callsign}, request ${String(value ?? kind).toLowerCase()}.`;
  const tx = queueTransmission(s, {
    aircraftId: a.id,
    speaker: 'PILOT',
    type: kind === 'DIVERSION' ? 'ABNORMAL' : 'REQUEST',
    text,
    priority,
    delayTicks: radioDelay(s, priority),
    meaning: request.id,
  });
  request.responseTick = tx.availableTick + tx.durationTicks;
  event(s, 'REQUEST', text, a.id, priority === 'URGENT' ? 'WARNING' : 'INFO');
}

export function stepRequests(s: SimulationState) {
  for (const r of s.pilotRequests)
    if (
      r.status === 'QUEUED' &&
      s.transmissions.some((tx) => tx.meaning === r.id && tx.status === 'COMPLETE')
    )
      r.status = 'PENDING';
  if (s.clock.tick % 40 !== 0) return;
  for (const a of s.aircraft) {
    if (
      !s.combinedSectors.includes(a.owner ?? '') ||
      a.identification !== 'IDENTIFIED' ||
      a.communication !== 'CONTACT'
    )
      continue;
    if (s.scenario.tutorial && s.tutorialStep === 5) {
      if (a.id !== 'AC00000') continue;
      if (s.clock.tick - a.lastCommunicationTick >= 40)
        createRequest(
          s,
          a,
          'HIGHER',
          Math.min(a.requestedAltitudeFt + 2000, 39000),
          'Training flight below preferred cruise level.',
        );
      if (s.pilotRequests.some((r) => r.aircraftId === a.id)) s.tutorialStep = 6;
      continue;
    }
    if (a.emergency.kind === 'WEATHER' && !a.emergency.acknowledged) {
      const escape = s.dataset.waypoints
        .filter((fix) => s.weather.every((cell) => distance(fix, cell) > cell.radiusNm + 30))
        .sort((x, y) => distance(a.position, x) - distance(a.position, y))[0];
      createRequest(s, a, 'WEATHER', escape?.id, 'Convective cell affects route.', 'ATTENTION');
      continue;
    }
    if (a.emergency.kind === 'MEDICAL' && !a.emergency.acknowledged) {
      createRequest(
        s,
        a,
        'DIVERSION',
        a.flightPlan.exitPoint,
        'Medical priority diversion.',
        'URGENT',
      );
      continue;
    }
    if (
      ['PERFORMANCE', 'MINIMUM_FUEL', 'FUEL', 'NAVIGATION'].includes(a.emergency.kind) &&
      !a.emergency.acknowledged
    ) {
      createRequest(
        s,
        a,
        a.emergency.kind === 'NAVIGATION' ? 'RETURN_ROUTE' : 'LOWER',
        a.emergency.kind === 'NAVIGATION' ? undefined : a.requestedAltitudeFt,
        `${a.emergency.kind.replaceAll('_', ' ').toLowerCase()} limitation.`,
        a.emergency.kind === 'FUEL' ? 'URGENT' : 'ATTENTION',
      );
      continue;
    }
    if (a.navigationMode === 'HEADING' && s.clock.tick - a.lastCommunicationTick > 240) {
      createRequest(s, a, 'RETURN_ROUTE', undefined, 'Extended vectoring.');
      continue;
    }
    const routeDistance = a.routeIntent.slice(a.nextWaypoint).reduce((sum, id, i, ids) => {
      const p = s.dataset.waypoints.find((w) => w.id === id);
      const prior = i ? s.dataset.waypoints.find((w) => w.id === ids[i - 1]) : a.position;
      return sum + (p && prior ? distance(prior, p) : 0);
    }, 0);
    if (
      a.requestedAltitudeFt > a.clearedAltitudeFt &&
      routeDistance > 120 &&
      (s.clock.tick + Number(a.id.slice(2))) % 1200 === 0
    ) {
      createRequest(s, a, 'HIGHER', a.requestedAltitudeFt, 'Below requested cruise level.');
    } else {
      const exit = s.dataset.waypoints.find((w) => w.id === a.flightPlan.exitPoint);
      const straight = exit ? distance(a.position, exit) : routeDistance;
      if (
        exit &&
        routeDistance > Math.max(120, straight * 1.28) &&
        (s.clock.tick + Number(a.id.slice(2))) % 1600 === 0
      )
        createRequest(
          s,
          a,
          'DIRECT',
          exit.id,
          'Remaining route is materially longer than direct track.',
        );
    }
  }
}

export function resolveRequest(s: SimulationState, a: Aircraft, approve: boolean) {
  const request = [...s.pilotRequests]
    .reverse()
    .find((r) => r.aircraftId === a.id && r.status === 'PENDING');
  if (!request) return 'No pilot request is awaiting a response.';
  request.status = approve ? 'APPROVED' : 'DENIED';
  if (approve) {
    s.metrics.approvedRequests++;
    if (request.kind === 'HIGHER' && typeof request.value === 'number')
      a.clearedAltitudeFt = request.value;
    if (request.kind === 'LOWER' && typeof request.value === 'number')
      a.clearedAltitudeFt = request.value;
    if (request.kind === 'RETURN_ROUTE') {
      a.navigationMode = 'ROUTE';
      a.assignedHeadingDeg = null;
    }
    if (
      ['DIRECT', 'WEATHER', 'DIVERSION'].includes(request.kind) &&
      typeof request.value === 'string'
    ) {
      a.routeIntent = [request.value];
      a.nextWaypoint = 0;
      a.navigationMode = 'ROUTE';
      a.assignedHeadingDeg = null;
    }
    if (a.emergency.kind !== 'NONE') a.emergency.acknowledged = true;
  } else s.metrics.deniedRequests++;
  a.controlState = 'MONITORING';
  event(
    s,
    approve ? 'REQUEST_APPROVED' : 'REQUEST_DENIED',
    `${a.callsign} request ${approve ? 'approved' : 'denied'}.`,
    a.id,
  );
  return null;
}
