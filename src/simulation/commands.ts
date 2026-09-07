import type { Aircraft, AIRACDataset, CommandIntent, SimulationState } from '../domain/types';
import { performance } from '../data';
import { tasFromIas, soundSpeed } from './math';
export const verbs = [
  'CLIMB FL370',
  'DESCEND FL310',
  'LEVEL FL350',
  'HEADING 090',
  'DIRECT SIMCA',
  'RESUME',
  'SPEED 280',
  'SPEED M080',
  'ACCEPT',
  'IDENTIFY',
  'TRANSFER S3',
  'CONTACT',
  'ACKNOWLEDGE',
];
export function parseCommand(
  text: string,
): { ok: true; intent: CommandIntent } | { ok: false; error: string } {
  const parts = text.trim().toUpperCase().split(/\s+/);
  const [callsign, verb, ...rest] = parts;
  const arg = rest.join(' ');
  if (!callsign || !verb)
    return { ok: false, error: 'Use CALLSIGN COMMAND VALUE, for example THY4AB CLIMB FL370.' };
  let kind = verb as CommandIntent['kind'],
    value: string | number | undefined;
  if (['CLIMB', 'DESCEND', 'LEVEL'].includes(verb)) {
    if (!/^FL\d{3}$/.test(arg)) return { ok: false, error: 'Specify a flight level: FL350.' };
    value = Number(arg.slice(2)) * 100;
  } else if (verb === 'MAINTAIN' && /^FL\d{3}$/.test(arg)) {
    kind = 'LEVEL';
    value = Number(arg.slice(2)) * 100;
  } else if (verb === 'HEADING') {
    if (!/^\d{1,3}$/.test(arg)) return { ok: false, error: 'Heading requires 000–360 degrees.' };
    value = Number(arg);
  } else if (verb === 'SPEED' || verb === 'MACH') {
    if (/^M0\d{2}$/.test(arg)) {
      kind = 'MACH';
      value = Number(arg.slice(1)) / 100;
    } else if (verb === 'MACH' && /^0\.\d{2}$/.test(arg)) {
      value = Number(arg);
    } else if (verb === 'SPEED' && /^\d{3}$/.test(arg)) {
      value = Number(arg);
    } else return { ok: false, error: 'Use SPEED 280 (IAS) or SPEED M080 (Mach).' };
  } else if (verb === 'DIRECT' || verb === 'TRANSFER') {
    if (!/^[A-Z0-9]+$/.test(arg))
      return { ok: false, error: `${verb} requires a ${verb === 'DIRECT' ? 'fix' : 'sector'}.` };
    value = arg;
  } else if (!['RESUME', 'ACCEPT', 'IDENTIFY', 'CONTACT', 'ACKNOWLEDGE'].includes(verb) || arg)
    return { ok: false, error: 'Unknown syntax. Select a command suggestion below.' };
  return { ok: true, intent: { callsign, kind, value } };
}
export function validateCommand(
  intent: CommandIntent,
  a: Aircraft,
  s: SimulationState,
  data: AIRACDataset,
): string | null {
  const { kind, value } = intent;
  if (
    ![
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
    ].includes(kind)
  )
    return 'Unknown clearance kind.';
  const p = performance(a.typeId);
  const own = s.combinedSectors.includes(a.owner ?? '');
  if (s.complete) return 'The shift has ended.';
  if (
    ['ACCEPT', 'IDENTIFY', 'TRANSFER', 'CONTACT'].includes(kind) &&
    a.history.some((h) => h.status === 'QUEUED' && h.command.kind === kind)
  )
    return 'This coordination instruction is already pending.';
  if (kind === 'ACCEPT')
    return !s.combinedSectors.includes(a.sectorId) &&
      !s.combinedSectors.includes(a.nextSector ?? '')
      ? 'This flight is not inbound to your sectors.'
      : !['INBOUND', 'COORDINATED', 'TRANSFER_PENDING'].includes(a.controlState)
        ? 'No inbound handoff is pending.'
        : null;
  if (kind === 'ACKNOWLEDGE')
    return a.emergency.kind === 'NONE' ? 'No abnormal transmission to acknowledge.' : null;
  if (!own) return 'Accept this aircraft before issuing control instructions.';
  if (a.communication === 'FAILED')
    return 'Communication failure: this aircraft cannot receive radio clearances.';
  if (kind === 'IDENTIFY')
    return a.identification === 'IDENTIFIED' ? 'Aircraft is already identified.' : null;
  if (a.identification !== 'IDENTIFIED')
    return 'Identify the correlated target before issuing a surveillance clearance.';
  if (kind === 'CONTACT')
    return a.controlState !== 'TRANSFER_INITIATED' ? 'Initiate a transfer first.' : null;
  if (kind === 'TRANSFER') {
    const target = data.sectors.find((sec) => sec.id === value);
    if (!target) return 'Unknown receiving sector.';
    if (target.id === a.owner) return 'Aircraft is already controlled by that sector.';
    if (!data.sectors.find((sec) => sec.id === a.sectorId)?.adjacent.includes(target.id))
      return 'Transfer requires an adjacent sector.';
    return null;
  }
  if (a.controlState === 'TRANSFER_INITIATED')
    return 'Complete the pending contact before a further clearance.';
  if (['CLIMB', 'DESCEND', 'LEVEL'].includes(kind)) {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value % 1000 !== 0 ||
      value < 14000 ||
      value > p.ceilingFt
    )
      return `Use a whole flight level between FL140 and FL${p.ceilingFt / 100}.`;
    if (value > 41000 && value !== 43000 && value !== 45000)
      return 'Above FL410, use the modeled standard levels FL430 or FL450.';
    if (!a.flightPlan.rvsm && value >= 29000 && value <= 41000)
      return 'Non-RVSM flight: this simulator does not authorize cruise clearances in RVSM airspace.';
    if (kind === 'CLIMB' && value <= a.altitudeFt)
      return 'Climb clearance must be above the actual level.';
    if (kind === 'DESCEND' && value >= a.altitudeFt)
      return 'Descend clearance must be below the actual level.';
  }
  if (
    kind === 'HEADING' &&
    (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 360)
  )
    return 'Heading must be between 000 and 360.';
  if (kind === 'DIRECT' && !data.waypoints.some((w) => w.id === value))
    return 'Unknown fix in this simulation dataset.';
  if (
    kind === 'SPEED' &&
    typeof value === 'number' &&
    tasFromIas(value, a.altitudeFt) / soundSpeed(a.altitudeFt) > p.maxMach
  )
    return 'Unable: IAS exceeds the modeled Mach limit at this altitude.';
  if (kind === 'RESUME' && a.navigationMode !== 'HEADING')
    return 'Aircraft is already following its route.';
  if (
    kind === 'SPEED' &&
    (typeof value !== 'number' || !Number.isFinite(value) || value < p.minIas || value > p.maxIas)
  )
    return `Unable: modeled IAS envelope ${p.minIas}–${p.maxIas} kt.`;
  if (
    kind === 'MACH' &&
    (typeof value !== 'number' || !Number.isFinite(value) || value < 0.4 || value > p.maxMach)
  )
    return `Unable: modeled Mach envelope M0.40–M${p.maxMach.toFixed(2)}.`;
  return null;
}
export function readback(a: Aircraft, intent: CommandIntent): string {
  const v = intent.value;
  const phrase: Record<string, string> = {
    CLIMB: `Climb flight level ${Number(v) / 100}`,
    DESCEND: `Descend flight level ${Number(v) / 100}`,
    LEVEL: `Maintain flight level ${Number(v) / 100}`,
    HEADING: `Heading ${String(v).padStart(3, '0')}`,
    DIRECT: `Direct ${v}`,
    RESUME: 'Resume own navigation',
    SPEED: `Speed ${v} knots`,
    MACH: `Mach ${Number(v).toFixed(2)}`,
    ACCEPT: 'Contact established',
    IDENTIFY: 'Radar contact',
    TRANSFER: `Coordination requested with ${v}`,
    CONTACT: 'Changing frequency',
    ACKNOWLEDGE: 'Priority request acknowledged',
  };
  return `${a.callsign}, ${phrase[intent.kind]}.`;
}
