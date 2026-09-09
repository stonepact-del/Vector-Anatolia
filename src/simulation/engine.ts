import { nextSectorAlongIntent } from './airspace';
import { fraWindowActive } from './fra';
import { assertState } from './invariants';
import { spawn } from './traffic';
import { event } from './events';
import type {
  Aircraft,
  AIRACDataset,
  RecordedAction,
  Clearance,
  CommandIntent,
  CommandResult,
  Replay,
  Scenario,
  SimulationState,
} from '../domain/types';
import { dataset, performance, scenarios } from '../data';
import { pilotResponse } from './pilot';
import { queueTransmission, radioDelay, stepRadio } from './communications';
import { offerOutbound, stepCoordination, updateAdjacentSectors } from './adjacentSectors';
import { buildAttention } from './attention';
import { resolveRequest, stepRequests } from './requests';
import { scheduleNextSpawn, trafficPhase } from './trafficDemand';
import { simulatorWorkload } from './workload';
import { validateDataset } from '../data/validation';
import { applyMotionIntent } from './intent';
import { advanceAircraft } from './aircraft';
import { readback, validateCommand } from './commands';
import {
  predictConflicts,
  segmentBreach,
  STCA_SECONDS,
  trafficInteractions,
  verticalMinimum,
} from './conflicts';
import { deltaHeading, distance, hash, sectorAt, STEP } from './math';
export const ENGINE_VERSION = '2.0.0';
export function challengeCode(scenarioId: string, seed: number, datasetVersion: string) {
  return `TR-${String(seed).padStart(4, '0')}-${hash(`${scenarioId}:${seed}:${datasetVersion}`).slice(0, 4).toUpperCase()}`;
}
export function fraActive(utcMs: number, altitude = 35000, data: AIRACDataset = dataset) {
  return fraWindowActive(utcMs, altitude, data);
}
export function createState(
  scenario: Scenario = scenarios[0],
  seed = scenario.seed,
  density = 1,
  duration = scenario.durationSec,
  data: AIRACDataset = dataset,
): SimulationState {
  const dataset = data;
  validateDataset(dataset);
  if (
    !Number.isInteger(seed) ||
    !Number.isFinite(duration) ||
    !Number.isFinite(scenario.initialTraffic) ||
    scenario.initialTraffic < 2 ||
    !Number.isFinite(scenario.spawnIntervalSec) ||
    scenario.spawnIntervalSec <= 0 ||
    !Number.isFinite(scenario.startUtcHour) ||
    !Array.isArray(scenario.events) ||
    !Number.isFinite(density) ||
    density < 0.2 ||
    density > 10 ||
    duration < 30 ||
    duration > 3600
  )
    throw Error('Invalid scenario settings.');
  const s: SimulationState = {
    dataset: structuredClone(dataset),
    readbacks: [],
    actions: [],
    engineVersion: ENGINE_VERSION,
    datasetVersion: dataset.version,
    scenario: {
      ...structuredClone(scenario),
      durationSec: duration,
      initialTraffic: Math.round(scenario.initialTraffic * density),
      spawnIntervalSec: scenario.spawnIntervalSec / density,
    },
    seed,
    rng: seed >>> 0,
    clock: {
      tick: 0,
      stepSec: STEP,
      paused: false,
      speed: 1,
      startUtcMs: Date.UTC(2025, 10, 27) + scenario.startUtcHour * 3600000,
    },
    aircraft: [],
    weather: scenario.weather
      ? [
          {
            id: 'WX1',
            x: 360,
            y: 140,
            radiusNm: 32,
            intensity: 0.8,
            drift: { x: 0.001, y: 0.0005 },
          },
          { id: 'WX2', x: 430, y: 240, radiusNm: 24, intensity: 0.65, drift: { x: 0.001, y: 0 } },
        ]
      : [],
    conflicts: [],
    interactions: [],
    alerts: [],
    events: [],
    nextEventId: 1,
    commands: [],
    commandSequence: 0,
    metrics: {
      handled: 0,
      losses: 0,
      lossSeconds: 0,
      stcaEpisodes: 0,
      resolvedConflicts: 0,
      clearances: 0,
      rejected: 0,
      goodHandoffs: 0,
      missedHandoffs: 0,
      peakWorkload: 0,
      extraMiles: 0,
      delaySeconds: 0,
      pilotRequests: 0,
      approvedRequests: 0,
      deniedRequests: 0,
      handoffDelayTicks: 0,
      transmissions: 0,
      peakFrequencyLoad: 0,
      unnecessaryInterventions: 0,
    },
    selectedSector: dataset.simulation.initialSector,
    combinedSectors: [dataset.simulation.initialSector],
    complete: false,
    tutorialStep: 0,
    spawned: 0,
    activeLosses: [],
    activeAlerts: [],
    activePredictions: [],
    fraActive: false,
    transmissions: [],
    pilotRequests: [],
    adjacentSectors: dataset.sectors.map((sector) => ({
      sectorId: sector.id,
      workload: 0,
      frequencyLoad: 0,
      pendingInbound: 0,
      pendingOutbound: 0,
      configuration: 'OPEN',
    })),
    attention: [],
    frequencyLoad: 0,
    trafficPhase: 'QUIET',
    trafficDemand: {
      profile: {
        id: `${scenario.id}-shift-curve`,
        waves: [
          { phase: 'QUIET', startRatio: 0, entryMultiplier: 0.65 },
          { phase: 'BUILDING', startRatio: 0.15, entryMultiplier: 1 },
          { phase: 'BUSY', startRatio: 0.35, entryMultiplier: 1.35 },
          { phase: 'PEAK', startRatio: 0.58, entryMultiplier: 1.65 },
          { phase: 'RECOVERY', startRatio: 0.78, entryMultiplier: 0.55 },
        ],
      },
      entryRate: {
        intervalSec: scenario.spawnIntervalSec,
        nextTick: Math.round(scenario.spawnIntervalSec / STEP),
      },
      flowPressure: dataset.trafficFlows.map((flow) => ({ flowId: flow.id, value: flow.weight })),
    },
    nextTransmissionId: 1,
    nextRequestId: 1,
    nextSpawnTick: Math.round(scenario.spawnIntervalSec / STEP),
    challengeCode: challengeCode(scenario.id, seed, dataset.version),
  };
  scheduleNextSpawn(s);
  for (let i = 0; i < s.scenario.initialTraffic; i++) spawn(s, true);
  s.fraActive = fraActive(s.clock.startUtcMs, 35000, dataset);
  if (scenario.conflict) {
    const [a, b] = s.aircraft;
    const center = dataset.sectors.find((sec) => sec.id === s.selectedSector)!.center;
    a.position = { x: center.x - 55, y: center.y };
    b.position = { x: center.x - 15, y: center.y };
    a.altitudeFt = b.altitudeFt = a.clearedAltitudeFt = b.clearedAltitudeFt = 35000;
    a.headingDeg = a.trackDeg = 90;
    b.headingDeg = b.trackDeg = 270;
    a.assignedHeadingDeg = 90;
    b.assignedHeadingDeg = 270;
    a.navigationMode = b.navigationMode = 'HEADING';
    for (const ac of [a, b]) {
      ac.owner = s.selectedSector;
      ac.sectorId = s.selectedSector;
      ac.controlState = 'CONTROLLED';
      ac.identification = 'IDENTIFIED';
      ac.communication = 'CONTACT';
    }
  }
  for (const a of s.aircraft.filter((a) => a.controlState === 'HANDOFF_OFFERED'))
    queueTransmission(s, {
      aircraftId: a.id,
      speaker: 'SYSTEM',
      type: 'HANDOFF',
      text: `Inbound handoff offered: ${a.callsign}, ${a.typeId}, flight level ${a.altitudeFt / 100}.`,
      priority: 'ATTENTION',
    });
  updateAdjacentSectors(s);
  s.attention = buildAttention(s);
  event(s, 'START', `${scenario.name} · synthetic airspace · seed ${seed}`);
  return s;
}
export function issueCommand(
  s: SimulationState,
  intent: CommandIntent,
  source: 'UI' | 'TEXT' | 'REPLAY' = 'UI',
  record = true,
): CommandResult {
  const dataset = s.dataset;
  if (record)
    s.actions.push({
      type: 'COMMAND',
      intent: structuredClone(intent),
      source,
      tick: s.clock.tick,
      sequence: s.actions.length,
    });
  const a = s.aircraft.find((a) => a.callsign === intent.callsign || a.id === intent.callsign);
  if (!a) return { ok: false, error: 'Aircraft not found.' };
  const error = validateCommand(intent, a, s, dataset);
  if (error) {
    s.metrics.rejected++;
    if (error.startsWith('Unable') && a.communication === 'CONTACT')
      queueTransmission(s, {
        aircraftId: a.id,
        speaker: 'PILOT',
        type: 'READBACK',
        text: `${a.callsign}, unable. ${error.replace(/^Unable:\s*/, '')}`,
        priority: 'ATTENTION',
        delayTicks: radioDelay(s, 'ATTENTION'),
      });
    event(s, 'REJECTED', `${a.callsign}: ${error}`, a.id, 'WARNING');
    return { ok: false, error };
  }
  const command: Clearance = {
    id: `C${s.commandSequence}`,
    aircraftId: a.id,
    kind: intent.kind,
    value: intent.value,
    tick: s.clock.tick,
    sequence: s.commandSequence++,
    source,
    actor: s.selectedSector,
  };
  s.commands.push(command);
  s.metrics.clearances++;
  if (
    ['CLIMB', 'DESCEND', 'LEVEL', 'HEADING', 'DIRECT', 'SPEED', 'MACH'].includes(intent.kind) &&
    !s.conflicts.some((c) => c.aircraftIds.includes(a.id)) &&
    !s.pilotRequests.some((r) => r.aircraftId === a.id && r.status === 'PENDING') &&
    a.history.some((h) => s.clock.tick - h.command.tick < 80)
  )
    s.metrics.unnecessaryInterventions++;
  const immediate = [
    'ACCEPT',
    'IDENTIFY',
    'TRANSFER',
    'CONTACT',
    'ACKNOWLEDGE',
    'APPROVE',
    'DENY',
  ].includes(intent.kind);
  const controllerTx = queueTransmission(s, {
    aircraftId: a.id,
    speaker: intent.kind === 'TRANSFER' ? 'SYSTEM' : 'CONTROLLER',
    type: intent.kind === 'TRANSFER' ? 'COORDINATION' : 'CLEARANCE',
    text: readback(a, intent),
    priority: intent.kind === 'ACKNOWLEDGE' ? 'URGENT' : 'ROUTINE',
    delayTicks: radioDelay(s),
    meaning: command.id,
  });
  const clarification = !immediate && s.scenario.difficulty >= 2 && command.sequence % 11 === 10;
  if (clarification) {
    s.readbacks.push({
      clearanceId: command.id,
      state: 'CLARIFY',
      text: `${a.callsign}, say again clearance.`,
      tick: s.clock.tick,
    });
    event(
      s,
      'CLARIFY',
      `${a.callsign}, say again clearance. Simulator repeats the instruction.`,
      a.id,
    );
    queueTransmission(s, {
      aircraftId: a.id,
      speaker: 'PILOT',
      type: 'READBACK',
      text: `${a.callsign}, say again clearance.`,
      priority: 'ATTENTION',
      delayTicks: controllerTx.durationTicks + radioDelay(s, 'ATTENTION'),
      meaning: `${command.id}:CLARIFICATION`,
    });
  }
  a.history.push({
    command,
    status: 'QUEUED',
    message: readback(a, intent),
    executeTick:
      controllerTx.availableTick +
      controllerTx.durationTicks +
      (immediate ? 1 : performance(a.typeId, s.dataset).responseTicks) +
      (clarification ? 8 : 0),
  });
  if (!immediate && a.controlState === 'CONTROLLED') a.controlState = 'CLEARANCE_PENDING';
  a.lastCommunicationTick = s.clock.tick;
  event(s, 'CLEARANCE', readback(a, intent), a.id);
  return { ok: true, command };
}
function execute(s: SimulationState, a: Aircraft, c: Clearance) {
  const value = c.value;
  applyMotionIntent(a, c);
  if (
    ['CLIMB', 'DESCEND', 'LEVEL', 'HEADING', 'DIRECT', 'RESUME', 'SPEED', 'MACH'].includes(c.kind)
  ) {
    const request = [...s.pilotRequests]
      .reverse()
      .find((r) => r.aircraftId === a.id && r.status === 'PENDING');
    if (request) {
      request.status = 'MODIFIED';
      request.responseTick = s.clock.tick;
      s.metrics.approvedRequests++;
      event(
        s,
        'REQUEST_MODIFIED',
        `${a.callsign} request answered with an amended clearance.`,
        a.id,
      );
    }
  }
  switch (c.kind) {
    case 'CLIMB':
    case 'DESCEND':
    case 'LEVEL':
      if (s.scenario.tutorial && s.tutorialStep === 3) s.tutorialStep = 4;
      break;
    case 'DIRECT':
      if (a.emergency.kind === 'WEATHER' || a.emergency.kind === 'MEDICAL')
        a.emergency.acknowledged = true;
      if (s.scenario.tutorial && s.tutorialStep === 4) s.tutorialStep = 5;
      break;
    case 'ACCEPT':
      a.owner = c.actor;
      a.controlState = 'HANDOFF_ACCEPTED';
      if (a.communication !== 'FAILED') a.communication = 'PENDING';
      if (a.handoff) {
        a.handoff.state = 'AGREED';
        a.handoff.acceptedTick = s.clock.tick;
      }
      if (s.scenario.tutorial && s.tutorialStep === 0) s.tutorialStep = 1;
      break;
    case 'IDENTIFY':
      a.identification = 'IDENTIFIED';
      a.controlState = 'CONTROLLED';
      a.communication = 'CONTACT';
      if (s.scenario.tutorial && s.tutorialStep === 2) s.tutorialStep = 3;
      break;
    case 'TRANSFER':
      offerOutbound(s, a, String(value));
      break;
    case 'CONTACT':
      if (a.handoff) {
        a.owner = a.handoff.to;
        a.handoff.state = 'COMPLETE';
        a.controlState = 'FREQUENCY_CHANGE';
        a.communication = 'OTHER';
        s.metrics.goodHandoffs++;
        s.metrics.handled++;
        event(s, 'HANDOFF', `${a.callsign} transferred to ${a.owner}.`, a.id);
        if (s.scenario.tutorial && s.tutorialStep >= 9) s.tutorialStep = 10;
      }
      break;
    case 'ACKNOWLEDGE':
      a.emergency.acknowledged = true;
      break;
    case 'APPROVE':
      resolveRequest(s, a, true);
      if (s.scenario.tutorial && s.tutorialStep === 6) s.tutorialStep = 7;
      break;
    case 'DENY':
      resolveRequest(s, a, false);
      break;
  }
}
export function workload(s: SimulationState, sector = s.selectedSector) {
  return simulatorWorkload(s, sector);
}
export function step(s: SimulationState) {
  const dataset = s.dataset;
  assertState(s);
  if (s.complete) return;
  s.clock.tick++;
  const tick = s.clock.tick;
  stepRadio(s);
  const before = new Map(
    s.aircraft.map((a) => [a.id, { p: { ...a.position }, alt: a.altitudeFt }]),
  );
  for (const a of s.aircraft) {
    for (const h of a.history.filter(
      (h) =>
        (h.status === 'QUEUED' &&
          h.executeTick! <= tick &&
          s.transmissions.some(
            (tx) =>
              tx.meaning === h.command.id && tx.speaker !== 'PILOT' && tx.status === 'COMPLETE',
          )) ||
        (h.status === 'READBACK_PENDING' &&
          s.transmissions.some(
            (tx) =>
              tx.meaning === h.command.id && tx.type === 'READBACK' && tx.status === 'COMPLETE',
          )),
    )) {
      if (
        h.status === 'QUEUED' &&
        !['ACCEPT', 'TRANSFER', 'ACKNOWLEDGE'].includes(h.command.kind)
      ) {
        if (a.communication === 'FAILED') {
          h.status = 'REJECTED';
          h.message = 'Unable to deliver: communication failure.';
          event(s, 'UNABLE', `${a.callsign}, no response.`, a.id, 'WARNING');
          continue;
        }
        const response = pilotResponse(a, h.command, tick);
        if (
          s.readbacks.some((r) => r.clearanceId === h.command.id && r.state === 'CLARIFY') &&
          response.state === 'CORRECT'
        )
          response.state = 'CORRECTED';
        s.readbacks.push(response);
        const tx = queueTransmission(s, {
          aircraftId: a.id,
          speaker: 'PILOT',
          type: 'READBACK',
          text: response.text,
          priority: 'ROUTINE',
          delayTicks: radioDelay(s),
          meaning: h.command.id,
        });
        h.status = 'READBACK_PENDING';
        h.executeTick = tx.availableTick + tx.durationTicks;
        a.controlState = 'READBACK_PENDING';
        continue;
      }
      if (
        h.status !== 'READBACK_PENDING' &&
        !['ACCEPT', 'TRANSFER', 'ACKNOWLEDGE'].includes(h.command.kind)
      ) {
        const response = pilotResponse(a, h.command, tick);
        if (
          s.readbacks.some((r) => r.clearanceId === h.command.id && r.state === 'CLARIFY') &&
          response.state === 'CORRECT'
        )
          response.state = 'CORRECTED';
        s.readbacks.push(response);
      }
      if (h.status === 'READBACK_PENDING') h.executeTick = tick;
      const completedReadback = [...s.readbacks]
        .reverse()
        .find((response) => response.clearanceId === h.command.id);
      if (h.status === 'READBACK_PENDING' && completedReadback?.state === 'UNABLE') {
        h.status = 'REJECTED';
        h.message = completedReadback.text;
        a.controlState = 'MONITORING';
        event(s, 'UNABLE', completedReadback.text, a.id, 'WARNING');
        continue;
      }
      if (
        h.status !== 'READBACK_PENDING' &&
        a.communication === 'FAILED' &&
        !['ACKNOWLEDGE', 'ACCEPT'].includes(h.command.kind)
      ) {
        h.status = 'REJECTED';
        h.message = 'Unable to deliver: communication failure.';
        event(s, 'UNABLE', `${a.callsign}, no response.`, a.id, 'WARNING');
      } else {
        execute(s, a, h.command);
        h.status = 'EXECUTED';
        if (
          ['CLIMB', 'DESCEND', 'LEVEL', 'HEADING', 'DIRECT', 'RESUME', 'SPEED', 'MACH'].includes(
            h.command.kind,
          )
        )
          a.controlState = 'EXECUTING';
        event(
          s,
          ['ACCEPT', 'TRANSFER'].includes(h.command.kind)
            ? 'COORDINATION'
            : h.command.kind === 'ACKNOWLEDGE'
              ? 'ACKNOWLEDGED'
              : 'READBACK',
          h.message,
          a.id,
        );
      }
    }
    advanceAircraft(a, dataset, STEP);
    if (a.controlState === 'HANDOFF_ACCEPTED' && tick - (a.handoff?.acceptedTick ?? tick) >= 4) {
      a.controlState = 'AWAITING_INITIAL_CONTACT';
      queueTransmission(s, {
        aircraftId: a.id,
        speaker: 'PILOT',
        type: 'INITIAL_CALL',
        text: `${a.callsign}, flight level ${Math.round(a.altitudeFt / 100)}, checking in.`,
        priority: 'ATTENTION',
        delayTicks: 6 + radioDelay(s, 'ATTENTION'),
        meaning: 'INITIAL_CONTACT',
      });
    }
    if (
      a.controlState === 'EXECUTING' &&
      a.verticalMode === 'LEVEL' &&
      Math.abs(a.altitudeFt - a.clearedAltitudeFt) < 1 &&
      (a.assignedHeadingDeg === null ||
        Math.abs(deltaHeading(a.headingDeg, a.assignedHeadingDeg)) < 1) &&
      (a.assignedSpeed === null ||
        (a.assignedSpeed.unit === 'IAS'
          ? Math.abs(a.iasKt - a.assignedSpeed.value) < 1
          : Math.abs(a.mach - a.assignedSpeed.value) < 0.005))
    )
      a.controlState = 'MONITORING';
    const initialCall = s.transmissions.find(
      (t) => t.aircraftId === a.id && t.meaning === 'INITIAL_CONTACT',
    );
    if (a.controlState === 'AWAITING_INITIAL_CONTACT' && initialCall?.status === 'COMPLETE') {
      a.controlState = 'INITIAL_CONTACT';
      a.communication = 'CONTACT';
      a.identification = 'CORRELATED';
      a.lastCommunicationTick = tick;
      event(s, 'INITIAL_CALL', initialCall.text, a.id);
      if (s.scenario.tutorial && s.tutorialStep === 1) s.tutorialStep = 2;
    }
    if (a.controlState === 'FREQUENCY_CHANGE' && tick - a.lastCommunicationTick > 20)
      a.controlState = 'TRANSFERRED';
    if (
      a.emergency.kind === 'WEATHER' &&
      a.emergency.acknowledged &&
      !s.weather.some((w) => distance(w, a.position) < w.radiusNm + 20)
    ) {
      a.emergency.resolved = true;
    }
    if (
      a.emergency.kind === 'MEDICAL' &&
      a.emergency.acknowledged &&
      a.routeIntent.slice(a.nextWaypoint).includes(a.flightPlan.exitPoint) &&
      a.clearedAltitudeFt <= a.requestedAltitudeFt
    ) {
      a.emergency.resolved = true;
    }
    if (
      a.emergency.kind === 'PERFORMANCE' &&
      a.emergency.acknowledged &&
      Math.abs(a.altitudeFt - a.requestedAltitudeFt) < 100
    )
      a.emergency.resolved = true;
    if (
      a.emergency.kind === 'NAVIGATION' &&
      a.emergency.acknowledged &&
      a.navigationMode === 'ROUTE'
    )
      a.emergency.resolved = true;
    if (tick % 20 === 0) {
      a.trail.push({ ...a.position });
      if (a.trail.length > 12) a.trail.shift();
    }
    const sector = sectorAt(a.position, dataset.sectors, a.sectorId);
    if (sector && sector.id !== a.sectorId) {
      const prior = a.sectorId;
      a.sectorId = sector.id;
      if (
        s.combinedSectors.includes(prior) &&
        a.owner === prior &&
        !s.combinedSectors.includes(sector.id) &&
        !a.boundaryViolation
      ) {
        a.boundaryViolation = true;
        s.metrics.missedHandoffs++;
        event(
          s,
          'MISSED_HANDOFF',
          `${a.callsign} crossed into ${sector.id} before transfer.`,
          a.id,
          'WARNING',
        );
      }
      if (s.combinedSectors.includes(sector.id) && !s.combinedSectors.includes(a.owner ?? '')) {
        a.controlState = 'HANDOFF_OFFERED';
        a.communication = 'PENDING';
        a.identification = 'CORRELATED';
        a.owner = null;
        a.handoff = { from: prior, to: sector.id, state: 'REQUESTED', initiatedTick: tick };
        queueTransmission(s, {
          aircraftId: a.id,
          speaker: 'SYSTEM',
          type: 'HANDOFF',
          text: `Inbound handoff offered: ${a.callsign} from ${prior}.`,
          priority: 'ATTENTION',
        });
        event(s, 'INBOUND', `${a.callsign}, inbound to ${sector.name}.`, a.id);
      } else if (
        !s.combinedSectors.includes(a.owner ?? '') &&
        !s.combinedSectors.includes(sector.id)
      ) {
        a.owner = sector.id;
        a.controlState = 'CONTROLLED';
      }
    }
    if (tick % 4 === 0) a.nextSector = nextSectorAlongIntent(a, dataset);
  }
  if (
    tick >= s.nextSpawnTick &&
    tick * STEP < s.scenario.durationSec - 120 &&
    s.aircraft.length < 350
  ) {
    spawn(s);
    scheduleNextSpawn(s);
  }
  for (const se of s.scenario.events) {
    if (tick === Math.round(se.atSec / STEP)) {
      const a = s.aircraft.find((a) => a.id === `AC${String(se.aircraftIndex).padStart(5, '0')}`);
      if (a) {
        a.emergency = { kind: se.kind, declaredTick: tick, acknowledged: false, resolved: false };
        if (se.kind === 'COMMS') a.communication = 'FAILED';
        if (se.kind === 'MEDICAL') {
          a.flightPlan.destination = dataset.simulation.medicalDestination;
          a.flightPlan.exitPoint = dataset.simulation.medicalFix;
          a.requestedAltitudeFt = 25000;
        }
        if (se.kind === 'FUEL') {
          a.requestedAltitudeFt = Math.min(a.clearedAltitudeFt, 29000);
          a.emergency.kind = 'MINIMUM_FUEL';
        }
        if (se.kind === 'PERFORMANCE') {
          a.assignedSpeed = { unit: 'IAS', value: Math.max(210, Math.round(a.iasKt - 30)) };
          a.requestedAltitudeFt = Math.min(a.clearedAltitudeFt, 31000);
        }
        if (se.kind === 'WEATHER') a.emergency.kind = 'WEATHER';
        if (se.kind === 'NAVIGATION') {
          a.navigationMode = 'HEADING';
          a.assignedHeadingDeg = a.headingDeg;
        }
        queueTransmission(s, {
          aircraftId: a.id,
          speaker: se.kind === 'COMMS' ? 'SYSTEM' : 'PILOT',
          type: 'ABNORMAL',
          text:
            se.kind === 'COMMS'
              ? `${a.callsign}: no radio response; communication failure indicated.`
              : `${a.callsign}, ${se.kind === 'MEDICAL' ? `PAN PAN, medical priority, request diversion via ${dataset.simulation.medicalFix}` : se.kind === 'WEATHER' ? 'request deviation due weather' : se.kind === 'FUEL' ? 'minimum fuel, request priority handling' : se.kind === 'NAVIGATION' ? 'navigation degraded, request return to route' : 'unable normal performance, request lower level'}.`,
          priority: se.kind === 'MEDICAL' ? 'URGENT' : 'ATTENTION',
        });
        event(
          s,
          'ABNORMAL',
          `${a.callsign}: ${se.kind === 'COMMS' ? 'Communication failure. Protect last accepted intent.' : se.kind === 'MEDICAL' ? `PAN PAN, medical urgency. Request diversion via ${dataset.simulation.medicalFix} and lower level.` : se.kind === 'WEATHER' ? 'Request deviation around weather.' : se.kind === 'NAVIGATION' ? 'Navigation degraded. Return-to-route request expected.' : 'Unable normal performance.'}`,
          a.id,
          'WARNING',
        );
      }
    }
  }
  for (const cell of s.weather) {
    cell.x += cell.drift.x * STEP;
    cell.y += cell.drift.y * STEP;
  }
  if (tick % 40 === 0)
    for (const a of s.aircraft)
      if (
        a.emergency.kind === 'NONE' &&
        s.weather.some((w) => distance(w, a.position) < w.radiusNm + 20)
      ) {
        a.emergency = { kind: 'WEATHER', declaredTick: tick, acknowledged: false, resolved: false };
        event(s, 'WEATHER', `${a.callsign}, request deviation due weather.`, a.id, 'WARNING');
      }
  stepRequests(s);
  if (s.scenario.tutorial && s.tutorialStep === 7 && tick % 40 === 0) s.tutorialStep = 8;
  stepCoordination(s);
  if (
    s.scenario.tutorial &&
    s.tutorialStep === 8 &&
    s.aircraft.some((a) => a.controlState === 'TRANSFER_ACCEPTED')
  )
    s.tutorialStep = 9;
  const currentLosses: string[] = [];
  for (let i = 0; i < s.aircraft.length; i++)
    for (let j = i + 1; j < s.aircraft.length; j++) {
      const a = s.aircraft[i],
        b = s.aircraft[j];
      if (distance(a.position, b.position) > dataset.separation.horizontalNm + 1) continue;
      const r = segmentBreach(
        before.get(a.id) ?? { p: a.position, alt: a.altitudeFt },
        { p: a.position, alt: a.altitudeFt },
        before.get(b.id) ?? { p: b.position, alt: b.altitudeFt },
        { p: b.position, alt: b.altitudeFt },
        verticalMinimum(a, b, dataset.separation),
        dataset.separation.horizontalNm,
      );
      if (
        r.breach &&
        [a, b].some(
          (ac) =>
            s.combinedSectors.includes(ac.sectorId) || s.combinedSectors.includes(ac.owner ?? ''),
        )
      ) {
        const id = [a.id, b.id].sort().join('/');
        currentLosses.push(id);
        s.metrics.lossSeconds += STEP;
        if (!s.activeLosses.includes(id)) {
          s.metrics.losses++;
          event(s, 'LOSS', `LOSS OF SEPARATION · ${a.callsign} / ${b.callsign}`, a.id, 'CRITICAL');
        }
      }
    }
  s.activeLosses = currentLosses;
  if (tick % 4 === 0) {
    s.interactions = trafficInteractions(s.aircraft);
    s.conflicts = predictConflicts(s.aircraft, dataset, true, tick);
    const relevant = (ids: string[]) =>
      ids.some((id) =>
        s.aircraft.some(
          (ac) =>
            ac.id === id &&
            (s.combinedSectors.includes(ac.sectorId) || s.combinedSectors.includes(ac.owner ?? '')),
        ),
      );
    const predictions = s.conflicts.filter((c) => relevant(c.aircraftIds)).map((c) => c.id);
    for (const id of s.activePredictions)
      if (!predictions.includes(id)) s.metrics.resolvedConflicts++;
    s.activePredictions = predictions;
    const alerts = s.conflicts.filter((c) => c.timeToConflictSec <= STCA_SECONDS);
    for (const c of alerts)
      if (!s.activeAlerts.includes(c.id) && relevant(c.aircraftIds)) {
        s.metrics.stcaEpisodes++;
        event(
          s,
          'STCA',
          `STCA · ${c.aircraftIds.map((id) => s.aircraft.find((a) => a.id === id)?.callsign).join(' / ')}`,
          c.aircraftIds[0],
          'CRITICAL',
        );
      }
    s.alerts = alerts.map((c) => ({
      id: c.id,
      aircraftIds: c.aircraftIds,
      startedTick: s.alerts.find((a) => a.id === c.id)?.startedTick ?? tick,
      timeToConflictSec: c.timeToConflictSec,
      actual: c.actual,
    }));
    s.activeAlerts = alerts.map((c) => c.id);
    s.metrics.peakWorkload = Math.max(
      s.metrics.peakWorkload,
      ...s.combinedSectors.map((sec) => workload(s, sec)),
    );
    updateAdjacentSectors(s);
    s.trafficPhase = trafficPhase(s);
    s.attention = buildAttention(s);
  }
  const active = fraActive(s.clock.startUtcMs + tick * STEP * 1000, 35000, dataset);
  if (active !== s.fraActive) {
    s.fraActive = active;
    event(
      s,
      'FRA',
      `Modeled FRA ${active ? 'ACTIVE — eligible direct routes available' : 'INACTIVE — planned airway routing applies'}.`,
    );
  }
  s.aircraft = s.aircraft.filter((a) => {
    if (
      a.position.x < dataset.simulation.bounds.minX - 20 ||
      a.position.x > dataset.simulation.bounds.maxX + 20 ||
      a.position.y < dataset.simulation.bounds.minY - 20 ||
      a.position.y > dataset.simulation.bounds.maxY + 20
    ) {
      s.metrics.extraMiles += Math.max(0, a.distanceNm - a.baselineNm);
      s.metrics.delaySeconds += Math.max(
        0,
        (tick - a.enteredTick) * STEP - (a.baselineNm / a.flightPlan.cruiseSpeed) * 3600,
      );
      event(s, 'EXIT', `${a.callsign} left the simulated network.`, a.id);
      return false;
    }
    return true;
  });
  if (tick * STEP >= s.scenario.durationSec) {
    s.complete = true;
    event(s, 'COMPLETE', 'Shift complete. Review safety, flow and efficiency.');
  }
}
export function stateHash(s: SimulationState) {
  return hash({
    ...s,
    clock: { ...s.clock, paused: false, speed: 1 },
    commands: s.commands.map((c) => ({ ...c, source: 'REPLAY' })),
    aircraft: s.aircraft.map((a) => ({
      ...a,
      history: a.history.map((h) => ({ ...h, command: { ...h.command, source: 'REPLAY' } })),
    })),
  });
}
export function eventHash(s: SimulationState) {
  return hash(s.events);
}
export function makeReplay(
  initial: SimulationState,
  s: SimulationState,
  checkpoints: Replay['checkpoints'] = [],
): Replay {
  return {
    format: 1,
    engineVersion: ENGINE_VERSION,
    datasetVersion: s.dataset.version,
    datasetHash: s.dataset.contentHash,
    scenario: initial.scenario,
    seed: initial.seed,
    initialState: structuredClone(initial),
    actions: structuredClone(s.actions),
    commands: structuredClone(s.commands),
    finalTick: s.clock.tick,
    finalHash: stateHash(s),
    checkpoints,
    createdAt: new Date().toISOString(),
    eventHash: eventHash(s),
  };
}
export function changeSector(s: SimulationState, sector: string, combine = false, record = true) {
  const dataset = s.dataset;
  if (s.complete) throw Error('The shift has ended.');
  if (!dataset.sectors.some((x) => x.id === sector)) throw Error('Unknown sector.');
  if (record)
    s.actions.push({
      type: 'SECTOR',
      sector,
      combine,
      tick: s.clock.tick,
      sequence: s.actions.length,
    });
  s.selectedSector = sector;
  s.combinedSectors = combine
    ? s.combinedSectors.includes(sector) && s.combinedSectors.length > 1
      ? s.combinedSectors.filter((id) => id !== sector)
      : [...new Set([...s.combinedSectors, sector])]
    : [sector];
  for (const a of s.aircraft) {
    if (a.communication === 'FAILED') continue;
    if (s.combinedSectors.includes(a.owner ?? '')) {
      a.communication = 'CONTACT';
      if (a.controlState === 'TRANSFERRED') a.controlState = 'CONTROLLED';
    } else if (a.owner) a.communication = 'OTHER';
  }
  event(
    s,
    'POSITION',
    `Position ${sector}${combine ? (s.combinedSectors.includes(sector) ? ' combined' : ' split') : ' selected'}.`,
  );
}
export function finishShift(s: SimulationState, record = true) {
  if (s.complete) return;
  if (record) s.actions.push({ type: 'FINISH', tick: s.clock.tick, sequence: s.actions.length });
  s.complete = true;
  s.clock.paused = true;
  event(s, 'COMPLETE', 'Shift ended by controller.');
}
export function applyAction(s: SimulationState, action: RecordedAction) {
  if (action.type === 'COMMAND') issueCommand(s, action.intent, action.source, false);
  else if (action.type === 'SECTOR') changeSector(s, action.sector, action.combine, false);
  else finishShift(s, false);
  s.actions.push(structuredClone(action));
}
export function replayTo(replay: Replay, tick = replay.finalTick): SimulationState {
  if (
    replay.engineVersion !== ENGINE_VERSION ||
    replay.datasetVersion !== replay.initialState.dataset.version ||
    replay.datasetHash !== replay.initialState.dataset.contentHash
  )
    throw Error('Replay is incompatible with this engine or dataset version.');
  const end = Math.min(Math.max(0, Math.floor(tick)), replay.finalTick);
  const checkpoint = [...replay.checkpoints].reverse().find((c) => c.tick <= end);
  const s = structuredClone(checkpoint?.state ?? replay.initialState);
  s.clock.paused = false;
  let ai = s.actions.length;
  while (s.clock.tick <= end) {
    while (ai < replay.actions.length && replay.actions[ai].tick === s.clock.tick)
      applyAction(s, replay.actions[ai++]);
    if (s.clock.tick === end || s.complete) break;
    step(s);
  }
  if (
    end === replay.finalTick &&
    (stateHash(s) !== replay.finalHash || eventHash(s) !== replay.eventHash)
  )
    throw Error(
      'Replay integrity check failed. The recording does not match this engine or has been altered.',
    );
  return s;
}
export const tutorialSteps = [
  {
    title: 'Accept inbound traffic',
    text: 'Select the offered THY flight. ACCEPT confirms the modeled inbound handoff.',
  },
  {
    title: 'Listen for initial contact',
    text: 'The flight is expected but not yet established. Watch the radio queue for its initial call.',
  },
  {
    title: 'Establish identification',
    text: 'After the initial call, IDENTIFY confirms the correlated target before surveillance instructions.',
  },
  {
    title: 'Issue a level clearance',
    text: 'Open LEVEL and choose a different flight level. Watch the readback and gradual climb or descent.',
  },
  {
    title: 'Shorten the route',
    text: 'Open DIRECT and select SIMCA. The aircraft turns gradually toward the fix.',
  },
  {
    title: 'Listen for a request',
    text: 'Aircraft requests arise from its flight state. Monitor ATTENTION and RADIO instead of a scripted popup.',
  },
  {
    title: 'Respond to the pilot',
    text: 'Approve or deny the pending request. The response changes the flight state and radio occupancy.',
  },
  {
    title: 'Monitor the result',
    text: 'Readbacks complete before execution. Watch the cleared level, trajectory and planning conflicts.',
  },
  {
    title: 'Coordinate outbound',
    text: 'Open TRANSFER and offer the flight to its adjacent sector. Acceptance time depends on that sector workload.',
  },
  {
    title: 'Complete the transfer',
    text: 'When ATTENTION shows TRANSFER ACCEPTED, instruct CONTACT. Responsibility changes after the frequency change.',
  },
  {
    title: 'Control cycle complete',
    text: 'You handled the full inbound, contact, clearance, request and outbound sequence. Continue or review the shift.',
  },
];
