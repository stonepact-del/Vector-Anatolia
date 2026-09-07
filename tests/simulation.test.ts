import { describe, expect, it } from 'vitest';
import { dataset, scenarios } from '../src/data';
import { advanceAircraft } from '../src/simulation/aircraft';
import { parseCommand, readback, validateCommand } from '../src/simulation/commands';
import {
  predictConflicts,
  separated,
  segmentBreach,
  verticalMinimum,
} from '../src/simulation/conflicts';
import {
  changeSector,
  createState,
  eventHash,
  finishShift,
  fraActive,
  issueCommand,
  makeReplay,
  replayTo,
  stateHash,
  step,
  workload,
} from '../src/simulation/engine';
import { validateFraRoute } from '../src/simulation/fra';
import {
  bearing,
  contains,
  deltaHeading,
  distance,
  haversineNm,
  iasFromTas,
  nextRandom,
  sectorAt,
  soundSpeed,
  tasFromIas,
  vector,
} from '../src/simulation/math';
const ticks = (s: ReturnType<typeof createState>, n: number) => {
  for (let i = 0; i < n; i++) step(s);
};
const controlled = () => {
  const s = createState(scenarios[0]);
  const a = s.aircraft[0];
  issueCommand(s, { callsign: a.callsign, kind: 'ACCEPT' });
  step(s);
  issueCommand(s, { callsign: a.callsign, kind: 'IDENTIFY' });
  step(s);
  return { s, a };
};
describe('geospatial primitives', () => {
  it('uses NM and nautical headings', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(bearing({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(90);
    expect(vector(90, 360).x).toBeCloseTo(0.1);
    expect(deltaHeading(359, 1)).toBe(2);
    expect(deltaHeading(1, 359)).toBe(-2);
    expect(haversineNm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(60.04, 1);
  });
  it('handles polygon edges without gaps', () => {
    const p = dataset.sectors[0].polygon;
    expect(contains({ x: 0, y: 0 }, p)).toBe(true);
    expect(contains({ x: 200, y: 190 }, p)).toBe(true);
    expect(contains({ x: 200.0001, y: 190 }, p)).toBe(false);
    expect(sectorAt({ x: 200, y: 95 }, dataset.sectors, 'S2')?.id).toBe('S2');
    expect(sectorAt({ x: 200.0001, y: 95 }, dataset.sectors)?.id).toBe('S2');
  });
  it('keeps IAS TAS and Mach distinct', () => {
    expect(tasFromIas(280, 35000)).toBeGreaterThan(450);
    expect(iasFromTas(tasFromIas(280, 35000), 35000)).toBeCloseTo(280);
    expect(soundSpeed(35000)).toBeLessThan(soundSpeed(0));
  });
});
describe('fixed-step and aircraft response', () => {
  it('is independent of render grouping and speed metadata', () => {
    const a = createState(),
      b = createState();
    a.clock.speed = 4;
    b.clock.speed = 0.5;
    for (let frames = 0; frames < 30; frames++) ticks(a, 4);
    for (let frames = 0; frames < 120; frames++) ticks(b, 1);
    expect(stateHash(a)).toBe(stateHash(b));
    expect(a.clock.tick * 0.25).toBe(30);
  });
  it('turns, climbs and accelerates gradually', () => {
    const { a } = controlled();
    a.navigationMode = 'HEADING';
    a.assignedHeadingDeg = (a.headingDeg + 90) % 360;
    a.clearedAltitudeFt = a.altitudeFt + 2000;
    a.assignedSpeed = { unit: 'IAS', value: 320 };
    const old = { h: a.headingDeg, alt: a.altitudeFt, tas: a.tasKt };
    advanceAircraft(a, dataset, 0.25);
    expect(Math.abs(deltaHeading(old.h, a.headingDeg))).toBeLessThan(1);
    expect(a.altitudeFt).toBeGreaterThan(old.alt);
    expect(a.altitudeFt).toBeLessThan(old.alt + 20);
    expect(a.tasKt).toBeGreaterThan(old.tas);
    expect(a.tasKt - old.tas).toBeLessThan(1);
  });
  it('captures a cleared altitude without overshoot', () => {
    const { a } = controlled();
    a.clearedAltitudeFt = a.altitudeFt - 100;
    for (let i = 0; i < 100; i++) advanceAircraft(a, dataset, 0.25);
    expect(a.altitudeFt).toBe(a.clearedAltitudeFt);
    expect(a.verticalMode).toBe('LEVEL');
  });
  it('has reproducible seeded draws', () => {
    expect(nextRandom(123)).toEqual(nextRandom(123));
    expect(nextRandom(123)).not.toEqual(nextRandom(124));
  });
});
describe('separation and prediction', () => {
  for (const h of [4.9999, 5, 5.0001])
    for (const v of [999.9999, 1000, 1000.0001])
      it(`separation boundary h=${h} v=${v}`, () => {
        const s = createState();
        const [a, b] = s.aircraft;
        a.position = { x: 0, y: 0 };
        b.position = { x: h, y: 0 };
        a.altitudeFt = 35000;
        b.altitudeFt = 35000 + v;
        expect(separated(a, b)).toBe(h >= 5 || v >= 1000);
      });
  it('applies RVSM inclusively and non-RVSM conservatively', () => {
    const [a, b] = createState().aircraft;
    for (const alt of [29000, 41000]) {
      a.altitudeFt = b.altitudeFt = alt;
      expect(verticalMinimum(a, b)).toBe(1000);
    }
    a.altitudeFt = b.altitudeFt = 41000.01;
    expect(verticalMinimum(a, b)).toBe(2000);
    a.altitudeFt = b.altitudeFt = 35000;
    b.flightPlan.rvsm = false;
    expect(verticalMinimum(a, b)).toBe(2000);
    a.altitudeFt = b.altitudeFt = 28999.99;
    expect(verticalMinimum(a, b)).toBe(1000);
  });
  it('finds swept crossings and excludes tangency', () => {
    const sample = (x: number, y: number, alt = 35000) => ({ p: { x, y }, alt });
    expect(
      segmentBreach(sample(-10, 0), sample(10, 0), sample(0, 0), sample(0, 0), 1000).breach,
    ).toBe(true);
    expect(
      segmentBreach(sample(-10, 5), sample(10, 5), sample(0, 0), sample(0, 0), 1000).breach,
    ).toBe(false);
    expect(
      segmentBreach(sample(-10, 0, 36000), sample(10, 0, 36000), sample(0, 0), sample(0, 0), 1000)
        .breach,
    ).toBe(false);
  });
  it('predicts a convergence before actual loss', () => {
    const s = createState(scenarios.find((s) => s.id === 'transit')!);
    s.aircraft = s.aircraft.slice(0, 2);
    const conflicts = predictConflicts(s.aircraft, dataset);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].actual).toBe(false);
    expect(conflicts[0].timeToConflictSec).toBeGreaterThan(100);
    expect(conflicts[0].timeToConflictSec).toBeLessThan(180);
  });
  it('matches the brute-force prediction oracle', () => {
    const s = createState(
      scenarios.find((s) => s.id === 'overload')!,
      81,
      1,
    );
    expect(
      predictConflicts(s.aircraft, dataset)
        .map((c) => c.id)
        .sort(),
    ).toEqual(
      predictConflicts(s.aircraft, dataset, false)
        .map((c) => c.id)
        .sort(),
    );
  });
  it('deduplicates safety-net episodes', () => {
    const s = createState(scenarios.find((s) => s.id === 'transit')!);
    s.aircraft = s.aircraft.slice(0, 2);
    s.aircraft[1].position.x = 270;
    ticks(s, 12);
    expect(s.alerts).toHaveLength(1);
    expect(s.metrics.stcaEpisodes).toBe(1);
  });
});
describe('commands, readback and ownership', () => {
  it.each([
    ['THY4AB CLIMB FL370', 'CLIMB', 37000],
    ['QTR81 DIRECT SIMCA', 'DIRECT', 'SIMCA'],
    ['UAE7 SPEED M080', 'MACH', 0.8],
    ['THY4AB MAINTAIN FL350', 'LEVEL', 35000],
  ])('parses %s', (text, kind, value) => {
    expect(parseCommand(text)).toEqual({
      ok: true,
      intent: { callsign: text.split(' ')[0], kind, value },
    });
  });
  it.each(['THY4AB CLIMB 370', 'THY4AB SPEED M800', 'THY4AB RESUME EXTRA', 'THY4AB BANANA', ''])(
    'rejects malformed input %s',
    (text) => expect(parseCommand(text).ok).toBe(false),
  );
  it('requires acceptance and identification', () => {
    const s = createState(),
      a = s.aircraft[0];
    expect(issueCommand(s, { callsign: a.callsign, kind: 'CLIMB', value: 39000 }).ok).toBe(false);
    issueCommand(s, { callsign: a.callsign, kind: 'ACCEPT' });
    step(s);
    expect(a.owner).toBe('S2');
    expect(a.controlState).toBe('ACCEPTED');
    expect(issueCommand(s, { callsign: a.callsign, kind: 'HEADING', value: 90 }).ok).toBe(false);
    issueCommand(s, { callsign: a.callsign, kind: 'IDENTIFY' });
    step(s);
    expect(a.identification).toBe('IDENTIFIED');
  });
  it('honors response delays and UI/text parity', () => {
    const x = controlled(),
      y = controlled();
    const target = x.a.altitudeFt === 39000 ? 37000 : 39000;
    const intent = { callsign: x.a.callsign, kind: 'LEVEL' as const, value: target };
    issueCommand(x.s, intent, 'UI');
    const parsed = parseCommand(`${y.a.callsign} LEVEL FL${target / 100}`);
    if (!parsed.ok) throw Error('parser');
    issueCommand(y.s, parsed.intent, 'TEXT');
    ticks(x.s, 11);
    ticks(y.s, 11);
    expect(x.a.clearedAltitudeFt).not.toBe(target);
    step(x.s);
    step(y.s);
    expect(x.a.clearedAltitudeFt).toBe(target);
    expect(x.a.altitudeFt).toBe(y.a.altitudeFt);
    expect(x.a.position).toEqual(y.a.position);
    expect(readback(x.a, intent)).toContain(`flight level ${target / 100}`);
  });
  it('rejects unsupported level and speed envelopes', () => {
    const { s, a } = controlled();
    for (const value of [NaN, Infinity, 13999, 35001, 42000, 47000])
      expect(
        validateCommand({ callsign: a.callsign, kind: 'LEVEL', value }, a, s, dataset),
      ).not.toBeNull();
    expect(
      validateCommand({ callsign: a.callsign, kind: 'MACH', value: 0.99 }, a, s, dataset),
    ).not.toBeNull();
  });
  it('transfers exactly one owner after contact', () => {
    const { s, a } = controlled();
    issueCommand(s, { callsign: a.callsign, kind: 'TRANSFER', value: 'S3' });
    step(s);
    expect(a.owner).toBe('S2');
    expect(a.controlState).toBe('TRANSFER_INITIATED');
    issueCommand(s, { callsign: a.callsign, kind: 'CONTACT' });
    step(s);
    expect(a.owner).toBe('S3');
    expect(a.handoff?.state).toBe('COMPLETE');
    expect(s.metrics.goodHandoffs).toBe(1);
  });
  it('records a missed boundary handoff', () => {
    const { s, a } = controlled();
    a.position = { x: 399.99, y: 90 };
    a.navigationMode = 'HEADING';
    a.headingDeg = 90;
    a.assignedHeadingDeg = 90;
    step(s);
    expect(a.sectorId).toBe('S3');
    expect(a.owner).toBe('S2');
    expect(s.metrics.missedHandoffs).toBe(1);
  });
});
describe('FRA and abnormalities', () => {
  it.each([
    [19.999, false],
    [20, true],
    [23.999, true],
    [0, true],
    [1.999, true],
    [2, false],
  ])('handles UTC hour %s', (hour, active) =>
    expect(fraActive(Date.UTC(2025, 10, 27) + hour * 3600000)).toBe(active),
  );
  it.each([
    [30499.99, false],
    [30500, true],
    [66000, true],
    [66000.01, false],
  ])('FRA vertical edge %s', (alt, active) =>
    expect(fraActive(Date.UTC(2025, 10, 27, 20), alt)).toBe(active),
  );
  it('rejects undesignated routing', () => {
    const a = createState().aircraft[0];
    expect(
      validateFraRoute(
        { ...a.flightPlan.route, waypoints: ['FAKE', 'SIMEA'] },
        a,
        dataset,
        Date.UTC(2025, 10, 27, 21),
      ),
    ).toContain('designated');
  });
  it('activates FRA with a deterministic event', () => {
    const s = createState(scenarios.find((s) => s.id === 'fra')!);
    ticks(s, 240);
    expect(s.fraActive).toBe(true);
    expect(s.events.filter((e) => e.type === 'FRA')).toHaveLength(1);
  });
  it('communication failure blocks delivered instructions', () => {
    const s = createState(scenarios.find((s) => s.id === 'comms')!);
    const a = s.aircraft[0];
    issueCommand(s, { callsign: a.callsign, kind: 'ACCEPT' });
    step(s);
    issueCommand(s, { callsign: a.callsign, kind: 'IDENTIFY' });
    ticks(s, 139);
    expect(a.communication).toBe('FAILED');
    expect(issueCommand(s, { callsign: a.callsign, kind: 'HEADING', value: 90 }).ok).toBe(false);
  });
  it('medical urgency changes destination and workload', () => {
    const s = createState(scenarios.find((s) => s.id === 'medical')!);
    const before = workload(s);
    ticks(s, 140);
    expect(s.aircraft[0].flightPlan.destination).toBe('LTAC');
    expect(s.aircraft[0].emergency.kind).toBe('MEDICAL');
    expect(workload(s)).toBeGreaterThanOrEqual(before);
  });
});
describe('replay and scenario determinism', () => {
  it('reconstructs accepted, rejected and position actions plus manual finish', () => {
    const s = createState(),
      initial = structuredClone(s),
      a = s.aircraft[0];
    issueCommand(s, { callsign: a.callsign, kind: 'HEADING', value: 500 });
    issueCommand(s, { callsign: a.callsign, kind: 'ACCEPT' });
    step(s);
    issueCommand(s, { callsign: a.callsign, kind: 'IDENTIFY' });
    ticks(s, 12);
    issueCommand(s, { callsign: a.callsign, kind: 'DIRECT', value: 'SIMCA' });
    ticks(s, 15);
    changeSector(s, 'S3', true);
    ticks(s, 13);
    finishShift(s);
    const r = makeReplay(initial, s),
      restored = replayTo(r);
    expect(stateHash(restored)).toBe(stateHash(s));
    expect(eventHash(restored)).toBe(eventHash(s));
  });
  it('seeks from checkpoints identically', () => {
    const s = createState(),
      initial = structuredClone(s);
    ticks(s, 60);
    const checkpoint = { tick: s.clock.tick, state: structuredClone(s) };
    ticks(s, 60);
    const r = makeReplay(initial, s, [checkpoint]);
    expect(stateHash(replayTo(r))).toBe(stateHash(s));
    expect(replayTo(r, 30).clock.tick).toBe(30);
  });
  it('rejects incompatible replays', () => {
    const s = createState(),
      r = makeReplay(s, s);
    r.engineVersion = 'other';
    expect(() => replayTo(r)).toThrow('incompatible');
  });
  it.each(scenarios.map((s) => [s.id, s] as const))(
    '%s remains finite and reproducible through events',
    (_id, scenario) => {
      const a = createState(scenario, 55, 0.65, 60),
        b = createState(scenario, 55, 0.65, 60);
      ticks(a, 240);
      ticks(b, 240);
      expect(stateHash(a)).toBe(stateHash(b));
      expect(a.complete).toBe(true);
      for (const ac of a.aircraft)
        expect(
          [ac.position.x, ac.position.y, ac.altitudeFt, ac.tasKt, ac.headingDeg].every(
            Number.isFinite,
          ),
        ).toBe(true);
      expect(a.events.at(-1)?.type).toBe('COMPLETE');
    },
  );
});
