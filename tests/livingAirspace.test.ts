import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dataset, scenarios } from '../src/data';
import {
  coordinationDelay,
  offerOutbound,
  stepCoordination,
} from '../src/simulation/adjacentSectors';
import { queueTransmission, stepRadio } from '../src/simulation/communications';
import {
  createState,
  eventHash,
  issueCommand,
  makeReplay,
  stateHash,
  step,
  workload,
} from '../src/simulation/engine';
import { trafficPhase } from '../src/simulation/trafficDemand';
import { trafficInteractions } from '../src/simulation/conflicts';
import { validateReplay } from '../src/persistence/validation';

const advanceUntil = (s: ReturnType<typeof createState>, condition: () => boolean, limit = 600) => {
  for (let i = 0; i < limit && !condition(); i++) step(s);
  expect(condition()).toBe(true);
};
const establish = () => {
  const s = createState(scenarios[0], 2609, 1, 900);
  const a = s.aircraft[0];
  issueCommand(s, { callsign: a.callsign, kind: 'ACCEPT' });
  advanceUntil(s, () => a.controlState === 'INITIAL_CONTACT');
  issueCommand(s, { callsign: a.callsign, kind: 'IDENTIFY' });
  advanceUntil(s, () => a.identification === 'IDENTIFIED');
  return { s, a };
};

describe('Living Airspace lifecycle', () => {
  it('moves an inbound through handoff, initial call and identification', () => {
    const s = createState();
    const a = s.aircraft[0];
    expect(a.controlState).toBe('HANDOFF_OFFERED');
    expect(s.transmissions.some((t) => t.type === 'INITIAL_CALL')).toBe(false);
    issueCommand(s, { callsign: a.callsign, kind: 'ACCEPT' });
    advanceUntil(s, () => a.controlState === 'HANDOFF_ACCEPTED');
    expect(a.owner).toBe(s.selectedSector);
    advanceUntil(s, () => a.controlState === 'INITIAL_CONTACT');
    expect(s.transmissions.find((t) => t.type === 'INITIAL_CALL')?.status).toBe('COMPLETE');
    issueCommand(s, { callsign: a.callsign, kind: 'IDENTIFY' });
    advanceUntil(s, () => a.controlState === 'CONTROLLED');
    expect(a.identification).toBe('IDENTIFIED');
  });

  it('does not expose a pilot transmission before its triggering condition', () => {
    const s = createState();
    for (let i = 0; i < 20; i++) step(s);
    expect(s.transmissions.some((t) => t.type === 'INITIAL_CALL')).toBe(false);
    issueCommand(s, { callsign: s.aircraft[0].callsign, kind: 'ACCEPT' });
    advanceUntil(s, () => s.transmissions.some((t) => t.type === 'INITIAL_CALL'));
  });

  it('turns advance notification into an inbound offer before sector entry', () => {
    const s = createState();
    const a = s.aircraft[1];
    a.owner = 'S1';
    a.sectorId = 'S1';
    a.nextSector = s.selectedSector;
    a.controlState = 'CONTROLLED';
    a.handoff = null;
    stepCoordination(s);
    expect(a.controlState).toBe('APPROACHING_SECTOR');
    expect(s.aircraft[1].handoff?.state).toBe('NONE');
    s.clock.tick += 12;
    stepCoordination(s);
    expect(a.controlState).toBe('HANDOFF_OFFERED');
    expect(s.aircraft[1].handoff?.state).toBe('REQUESTED');
    expect(s.transmissions.at(-1)?.type).toBe('HANDOFF');
  });

  it('orders the radio deterministically by priority then availability', () => {
    const a = createState(),
      b = createState();
    for (const s of [a, b]) {
      s.transmissions = [];
      queueTransmission(s, {
        speaker: 'PILOT',
        type: 'REQUEST',
        text: 'routine',
        priority: 'ROUTINE',
      });
      queueTransmission(s, {
        speaker: 'PILOT',
        type: 'ABNORMAL',
        text: 'urgent',
        priority: 'URGENT',
      });
      stepRadio(s);
    }
    expect(a.transmissions.find((t) => t.status === 'TRANSMITTING')?.text).toBe('urgent');
    expect(a.transmissions).toEqual(b.transmissions);
  });

  it('derives frequency occupancy from transmissions', () => {
    const s = createState();
    s.transmissions = [];
    queueTransmission(s, {
      speaker: 'CONTROLLER',
      type: 'CLEARANCE',
      text: 'Long modeled controller transmission',
      durationTicks: 40,
    });
    for (let i = 0; i < 20; i++) {
      s.clock.tick++;
      stepRadio(s);
    }
    expect(s.frequencyLoad).toBeGreaterThan(0);
    expect(s.metrics.peakFrequencyLoad).toBeGreaterThan(0);
  });

  it('waits for one completed pilot readback before executing a clearance', () => {
    const { s, a } = establish();
    const target = a.altitudeFt >= 37000 ? 35000 : a.altitudeFt + 2000;
    const result = issueCommand(s, { callsign: a.callsign, kind: 'LEVEL', value: target });
    expect(result.ok).toBe(true);
    const commandId = result.ok ? result.command.id : '';
    advanceUntil(s, () => a.history.at(-1)?.status === 'READBACK_PENDING');
    expect(a.clearedAltitudeFt).not.toBe(target);
    const readback = s.transmissions.filter(
      (tx) => tx.meaning === commandId && tx.speaker === 'PILOT' && tx.type === 'READBACK',
    );
    expect(readback).toHaveLength(1);
    advanceUntil(s, () => a.history.at(-1)?.status === 'EXECUTED');
    expect(readback[0].status).toBe('COMPLETE');
    expect(a.clearedAltitudeFt).toBe(target);
    expect(s.readbacks.filter((item) => item.clearanceId === commandId)).toHaveLength(1);
  });

  it('rejects a clearance after a deterministic performance unable response', () => {
    const { s, a } = establish();
    const before = a.clearedAltitudeFt;
    const target = Math.max(14000, before - 2000);
    a.emergency = {
      kind: 'PERFORMANCE',
      declaredTick: s.clock.tick,
      acknowledged: false,
      resolved: false,
    };
    a.requestedAltitudeFt = Math.max(14000, target - 2000);
    const result = issueCommand(s, { callsign: a.callsign, kind: 'LEVEL', value: target });
    expect(result.ok).toBe(true);
    advanceUntil(s, () => a.history.at(-1)?.status === 'REJECTED');
    expect(a.clearedAltitudeFt).toBe(before);
    expect(s.readbacks.at(-1)?.state).toBe('UNABLE');
  });

  it('creates and approves a condition-driven pilot request', () => {
    const { s, a } = establish();
    s.tutorialStep = 5;
    advanceUntil(s, () => s.pilotRequests.some((r) => r.status === 'PENDING'));
    expect(s.pilotRequests[0].aircraftId).toBe(a.id);
    expect(a.controlState).toBe('REQUEST_PENDING');
    issueCommand(s, { callsign: a.callsign, kind: 'APPROVE' });
    advanceUntil(s, () => s.pilotRequests[0].status === 'APPROVED');
    expect(s.metrics.approvedRequests).toBe(1);
  });

  it('denies a pending request without changing ownership', () => {
    const { s, a } = establish();
    s.tutorialStep = 5;
    advanceUntil(s, () => s.pilotRequests.some((r) => r.status === 'PENDING'));
    issueCommand(s, { callsign: a.callsign, kind: 'DENY' });
    advanceUntil(s, () => s.pilotRequests[0].status === 'DENIED');
    expect(a.owner).toBe(s.selectedSector);
    expect(s.metrics.deniedRequests).toBe(1);
  });

  it('delays outbound acceptance according to adjacent workload', () => {
    const low = establish(),
      high = establish();
    low.s.adjacentSectors.find((x) => x.sectorId === 'S3')!.workload = 10;
    high.s.adjacentSectors.find((x) => x.sectorId === 'S3')!.workload = 90;
    expect(coordinationDelay(high.s, 'S3')).toBeGreaterThan(coordinationDelay(low.s, 'S3'));
    offerOutbound(low.s, low.a, 'S3');
    advanceUntil(low.s, () => low.a.controlState === 'TRANSFER_ACCEPTED');
    expect(low.a.owner).toBe('S2');
  });

  it('prevents transferred traffic from accepting player clearances', () => {
    const { s, a } = establish();
    offerOutbound(s, a, 'S3');
    advanceUntil(s, () => a.controlState === 'TRANSFER_ACCEPTED');
    issueCommand(s, { callsign: a.callsign, kind: 'CONTACT' });
    advanceUntil(s, () => a.owner === 'S3');
    expect(issueCommand(s, { callsign: a.callsign, kind: 'HEADING', value: 90 }).ok).toBe(false);
  });

  it('allows the controller to acknowledge a detected communication failure', () => {
    const { s, a } = establish();
    a.communication = 'FAILED';
    a.emergency = {
      kind: 'COMMS',
      declaredTick: s.clock.tick,
      acknowledged: false,
      resolved: false,
    };
    const result = issueCommand(s, { callsign: a.callsign, kind: 'ACKNOWLEDGE' });
    expect(result.ok).toBe(true);
    const commandId = result.ok ? result.command.id : '';
    advanceUntil(s, () => a.emergency.acknowledged);
    expect(
      s.transmissions.some(
        (tx) =>
          tx.aircraftId === a.id &&
          tx.meaning === commandId &&
          tx.speaker === 'PILOT' &&
          tx.type === 'READBACK',
      ),
    ).toBe(false);
  });
});

describe('Living Airspace causality and determinism', () => {
  it('separates nearby traffic interaction from predicted conflict and safety alert', () => {
    const s = createState();
    const [a, b] = s.aircraft;
    a.position = { x: 200, y: 180 };
    b.position = { x: 214, y: 180 };
    a.altitudeFt = b.altitudeFt = 35000;
    expect(trafficInteractions([a, b])).toHaveLength(1);
    expect(s.alerts).toHaveLength(0);
  });
  it('moves traffic demand through a recoverable shift shape', () => {
    const s = createState(undefined, 7, 1, 1000);
    const samples = [0, 200, 400, 650, 900].map((seconds) => {
      s.clock.tick = seconds * 4;
      return trafficPhase(s);
    });
    expect(samples).toEqual(['QUIET', 'BUILDING', 'BUSY', 'PEAK', 'RECOVERY']);
  });

  it('turns weather proximity into a request through state', () => {
    const { s, a } = establish();
    s.weather = [{ id: 'WX', ...a.position, radiusNm: 25, intensity: 1, drift: { x: 0, y: 0 } }];
    advanceUntil(s, () =>
      s.pilotRequests.some((r) => r.aircraftId === a.id && r.kind === 'WEATHER'),
    );
    expect(a.emergency.kind).toBe('WEATHER');
  });

  it('keeps workload bounded and responds to real queues', () => {
    const s = createState();
    const before = workload(s);
    for (let i = 0; i < 12; i++)
      queueTransmission(s, { speaker: 'PILOT', type: 'REQUEST', text: `request ${i}` });
    expect(workload(s)).toBeGreaterThan(before);
    expect(workload(s)).toBeLessThanOrEqual(100);
  });

  it('reproduces challenge code, system event chain and replay hash', () => {
    const a = createState(scenarios[5], 7123, 1, 180),
      b = createState(scenarios[5], 7123, 1, 180);
    const initial = structuredClone(a);
    for (let i = 0; i < 720; i++) {
      step(a);
      step(b);
    }
    expect(a.challengeCode).toBe(b.challengeCode);
    expect(eventHash(a)).toBe(eventHash(b));
    expect(stateHash(a)).toBe(stateHash(b));
    const replay = makeReplay(initial, a);
    expect(replay.engineVersion).toBe('2.0.0');
  });

  it('rejects V1 recordings with an explicit compatibility message', () => {
    const s = createState(),
      replay = makeReplay(s, s);
    replay.engineVersion = '1.0.0';
    expect(() => validateReplay(replay)).toThrow('incompatible with Living Airspace');
  });

  it('contains no nondeterministic random calls in causal modules', () => {
    for (const file of [
      'trafficDemand.ts',
      'requests.ts',
      'adjacentSectors.ts',
      'communications.ts',
    ])
      expect(readFileSync(`src/simulation/${file}`, 'utf8')).not.toContain('Math.random');
  });

  it('bundles public-domain geography separately from modeled sectors', () => {
    expect(dataset.simulation.geographicSource.license).toBe('Public domain');
    expect(dataset.simulation.geographicSource.fidelity).toBe('VERIFIED');
    expect(dataset.simulation.geographicOutline[0].length).toBeGreaterThan(40);
    expect(dataset.synthetic).toBe(true);
  });
});
