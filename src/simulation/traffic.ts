import type { Aircraft, SimulationState } from '../domain/types';
import { aircraftTypes, dataset, flows, performance } from '../data';
import { validateFraRoute } from './fra';
import { event } from './events';
import { bearing, distance, iasFromTas, nextRandom, sectorAt, soundSpeed } from './math';
import { verticalMinimum } from './conflicts';
function random(s: SimulationState) {
  const [rng, value] = nextRandom(s.rng);
  s.rng = rng;
  return value;
}
export function spawn(s: SimulationState, initial = false) {
  const index = s.spawned++;
  const flowIndex =
    s.scenario.id === 'istanbul'
      ? 5
      : s.scenario.id === 'summer'
        ? 6
        : s.scenario.fra
          ? 8
          : Math.floor(random(s) * flows.length);
  const flow = flows[flowIndex];
  let route = [...flow.routes[0]];
  if (random(s) > 0.5) route.reverse();
  const type = aircraftTypes[index < 2 ? index : Math.floor(random(s) * aircraftTypes.length)];
  const p = performance(type.id);
  const level =
    p.category === 'TURBOPROP'
      ? 23000
      : [31000, 33000, 35000, 37000, 39000][Math.floor(random(s) * 5)];
  let start = dataset.waypoints.find((w) => w.id === route[0])!;
  let nextWaypoint = 1;
  let position = { x: start.x, y: start.y };
  if (initial) {
    const leg = Math.floor(random(s) * (route.length - 1));
    start = dataset.waypoints.find((w) => w.id === route[leg])!;
    const end = dataset.waypoints.find((w) => w.id === route[leg + 1])!;
    const frac = random(s);
    position = { x: start.x + (end.x - start.x) * frac, y: start.y + (end.y - start.y) * frac };
    nextWaypoint = leg + 1;
  }
  if (index === 0) {
    route = ['SIMWA', 'SIMLA', 'SIMCA', 'SIMEA'];
    position = { x: 245, y: 105 };
    nextWaypoint = 1;
  }
  if (index === 1) {
    route = ['SIMNA', 'SIMLA', 'SIMLB', 'SIMSA'];
    position = { x: 315, y: 50 };
    nextWaypoint = 1;
  }
  const target = dataset.waypoints.find((w) => w.id === route[nextWaypoint])!;
  const sector = sectorAt(position, dataset.sectors)?.id ?? 'S2';
  const heading = bearing(position, target);
  const controlled = s.combinedSectors.includes(sector);
  const callsign =
    ['THY', 'PGT', 'SXS', 'QTR', 'UAE', 'DLH', 'BAW', 'FDB'][index % 8] +
    String(100 + Math.floor(random(s) * 899)) +
    (index % 3 === 0 ? 'A' : '');
  const id = `AC${String(index).padStart(5, '0')}`;
  const a: Aircraft = {
    id,
    callsign,
    typeId: type.id,
    position,
    altitudeFt: level,
    clearedAltitudeFt: level,
    requestedAltitudeFt: level,
    headingDeg: heading,
    trackDeg: heading,
    assignedHeadingDeg: null,
    tasKt: p.cruiseTas,
    iasKt: iasFromTas(p.cruiseTas, level),
    groundSpeedKt: p.cruiseTas,
    mach: p.cruiseTas / soundSpeed(level),
    assignedSpeed: null,
    verticalMode: 'LEVEL',
    navigationMode: 'ROUTE',
    flightPlan: {
      origin: flow.origins[index % flow.origins.length],
      destination: flow.destinations[index % flow.destinations.length],
      entryPoint: route[0],
      exitPoint: route.at(-1)!,
      route: {
        id: `R${index}`,
        waypoints: route,
        legs: route.slice(1).map((to, i) => ({ from: route[i], to, kind: 'AIRWAY' })),
      },
      requestedCruiseFt: level,
      assignedCruiseFt: level,
      cruiseSpeed: p.cruiseTas,
      rvsm: p.category !== 'TURBOPROP',
      wake: type.wake,
      flowId: flow.id,
    },
    routeIntent: [...route],
    nextWaypoint,
    owner: controlled && index !== 0 ? sector : null,
    sectorId: sector,
    nextSector: null,
    controlState: controlled ? 'INBOUND' : 'CONTROLLED',
    identification: controlled ? 'CORRELATED' : 'IDENTIFIED',
    communication: controlled ? 'PENDING' : 'OTHER',
    handoff: null,
    emergency: { kind: 'NONE', declaredTick: 0, acknowledged: false, resolved: false },
    history: [],
    trail: [],
    enteredTick: s.clock.tick,
    distanceNm: 0,
    baselineNm: distance(
      position,
      dataset.waypoints.find((w) => w.id === route.at(-1))!,
    ),
    boundaryViolation: false,
    lastCommunicationTick: 0,
  };
  if (controlled && index !== 0) {
    a.controlState = 'CONTROLLED';
    a.identification = 'IDENTIFIED';
    a.communication = 'CONTACT';
  }
  if (!controlled) a.owner = sector;
  if (s.scenario.fra && s.fraActive) {
    const direct = {
      ...a.flightPlan.route,
      waypoints: [route[0], route.at(-1)!],
      legs: [{ from: route[0], to: route.at(-1)!, kind: 'DIRECT' as const }],
    };
    if (!validateFraRoute(direct, a, dataset, s.clock.startUtcMs + s.clock.tick * 250)) {
      a.flightPlan.route = direct;
      a.routeIntent = direct.waypoints;
      a.nextWaypoint = 1;
      event(s, 'FRA_ROUTE', `${a.callsign} entered on an eligible modeled FRA direct route.`, a.id);
    }
  }
  const blocked = () =>
    s.aircraft.some(
      (b) =>
        distance(a.position, b.position) < 8 &&
        Math.abs(a.altitudeFt - b.altitudeFt) < verticalMinimum(a, b),
    );
  if (blocked()) {
    for (const candidate of [23000, 25000, 27000, 31000, 33000, 35000, 37000, 39000, 41000]) {
      if (candidate > p.ceilingFt || (!a.flightPlan.rvsm && candidate >= 29000)) continue;
      a.altitudeFt = a.clearedAltitudeFt = candidate;
      if (!blocked()) break;
    }
    if (blocked()) {
      event(s, 'FLOW_HOLD', `${a.callsign} entry delayed: no separated entry slot.`, a.id);
      return;
    }
    a.flightPlan.assignedCruiseFt = a.clearedAltitudeFt;
  }
  s.aircraft.push(a);
  if (!initial) event(s, 'INBOUND', `${callsign} entered the network.`, id);
}
