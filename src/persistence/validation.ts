import type { RecordedAction, Replay, SimulationState } from '../domain/types';
import type { Settings } from './store';
import { assertState } from '../simulation/invariants';
import { validateDataset } from '../data/validation';
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');
export function validateSettings(value: unknown): asserts value is Settings {
  if (
    !record(value) ||
    typeof value.accepted !== 'boolean' ||
    typeof value.labels !== 'boolean' ||
    typeof value.reducedMotion !== 'boolean' ||
    !strings(value.completed) ||
    !record(value.bests) ||
    !Object.values(value.bests).every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0)
  )
    throw Error(
      'Saved settings are corrupt. Reset local data in Settings or import a valid backup.',
    );
}
const commandKinds = new Set([
  'CLIMB',
  'DESCEND',
  'LEVEL',
  'HEADING',
  'DIRECT',
  'RESUME',
  'SPEED',
  'MACH',
  'ACCEPT',
  'IDENTIFY',
  'TRANSFER',
  'CONTACT',
  'ACKNOWLEDGE',
  'APPROVE',
  'DENY',
]);
function validateActions(actions: RecordedAction[], maxTick: number) {
  let prior = -1;
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    if (!a || !Number.isInteger(a.tick) || a.tick < prior || a.tick > maxTick || a.sequence !== i)
      throw Error('Replay action order is invalid.');
    prior = a.tick;
    if (a.type === 'COMMAND') {
      if (
        !a.intent ||
        typeof a.intent.callsign !== 'string' ||
        !commandKinds.has(a.intent.kind) ||
        !['UI', 'TEXT', 'REPLAY'].includes(a.source) ||
        !(
          a.intent.value === undefined ||
          typeof a.intent.value === 'string' ||
          (typeof a.intent.value === 'number' && Number.isFinite(a.intent.value))
        )
      )
        throw Error('Replay command is invalid.');
    } else if (a.type === 'SECTOR') {
      if (typeof a.sector !== 'string' || typeof a.combine !== 'boolean')
        throw Error('Replay position action is invalid.');
    } else if (a.type !== 'FINISH') throw Error('Replay action is unknown.');
  }
}
function validateState(s: SimulationState) {
  validateDataset(s.dataset);
  if (
    !s ||
    !s.clock ||
    !Array.isArray(s.aircraft) ||
    s.aircraft.length > 350 ||
    !s.scenario ||
    !Number.isFinite(s.scenario.durationSec) ||
    s.scenario.durationSec < 30 ||
    s.scenario.durationSec > 3600 ||
    !Array.isArray(s.scenario.events) ||
    !s.metrics ||
    !strings(s.combinedSectors)
  )
    throw Error('Replay initial state is invalid.');
  for (const key of [
    'actions',
    'readbacks',
    'events',
    'commands',
    'conflicts',
    'interactions',
    'alerts',
    'weather',
    'activeLosses',
    'activeAlerts',
    'activePredictions',
    'transmissions',
    'pilotRequests',
    'adjacentSectors',
    'attention',
  ] as const)
    if (!Array.isArray(s[key])) throw Error(`Replay ${key} are invalid.`);
  if (
    !Object.values(s.metrics).every(Number.isFinite) ||
    !Number.isFinite(s.clock.startUtcMs) ||
    s.clock.stepSec !== 0.25 ||
    !Number.isFinite(s.frequencyLoad) ||
    !Number.isInteger(s.nextTransmissionId) ||
    !Number.isInteger(s.nextRequestId) ||
    !Number.isInteger(s.nextSpawnTick) ||
    typeof s.challengeCode !== 'string'
  )
    throw Error('Replay clock or metrics are invalid.');
  if (
    !s.trafficDemand ||
    !s.trafficDemand.profile ||
    !Array.isArray(s.trafficDemand.profile.waves) ||
    !Array.isArray(s.trafficDemand.flowPressure)
  )
    throw Error('Replay traffic demand state is invalid.');
  for (const a of s.aircraft) {
    if (
      !a ||
      !a.position ||
      !a.flightPlan ||
      !s.dataset.aircraftTypes.some((t) => t.id === a.typeId) ||
      !strings(a.routeIntent) ||
      !Array.isArray(a.history) ||
      !Array.isArray(a.trail) ||
      !a.emergency ||
      !Number.isInteger(a.nextWaypoint) ||
      a.nextWaypoint < 0 ||
      typeof a.callsign !== 'string'
    )
      throw Error('Replay aircraft is invalid.');
    for (const h of a.history)
      if (!h.command || !commandKinds.has(h.command.kind) || !Number.isInteger(h.executeTick))
        throw Error('Replay clearance history is invalid.');
  }
  assertState(s);
}
export function validateReplay(value: unknown): asserts value is Replay {
  if (record(value) && typeof value.engineVersion === 'string' && value.engineVersion !== '2.0.0')
    throw Error(
      `Replay engine ${value.engineVersion} is incompatible with Living Airspace 2.0. Export or remove the older recording; it will not be replayed incorrectly.`,
    );
  if (
    !record(value) ||
    value.format !== 1 ||
    typeof value.engineVersion !== 'string' ||
    typeof value.datasetVersion !== 'string' ||
    typeof value.datasetHash !== 'string' ||
    typeof value.finalHash !== 'string' ||
    typeof value.eventHash !== 'string' ||
    typeof value.createdAt !== 'string' ||
    !Number.isInteger(value.finalTick) ||
    Number(value.finalTick) < 0 ||
    Number(value.finalTick) > 14400 ||
    !Array.isArray(value.actions) ||
    value.actions.length > 100000 ||
    !Array.isArray(value.commands) ||
    value.commands.length > 100000 ||
    !Array.isArray(value.checkpoints) ||
    value.checkpoints.length > 60 ||
    !record(value.scenario) ||
    typeof value.scenario.name !== 'string'
  )
    throw Error('Invalid replay data.');
  const r = value as unknown as Replay;
  validateState(r.initialState);
  validateActions(r.actions, r.finalTick);
  if (r.initialState.clock.tick !== 0 || r.initialState.actions.length !== 0)
    throw Error('Replay must begin at its original initial state.');
  let prior = 0;
  for (const c of r.checkpoints) {
    if (!c || !Number.isInteger(c.tick) || c.tick <= prior || c.tick > r.finalTick)
      throw Error('Invalid replay checkpoint.');
    validateState(c.state);
    if (c.state.clock.tick !== c.tick) throw Error('Replay checkpoint tick mismatch.');
    validateActions(c.state.actions, c.tick);
    prior = c.tick;
  }
}
