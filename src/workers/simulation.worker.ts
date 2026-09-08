import type { Replay, SimulationState, WorkerRequest, WorkerResponse } from '../domain/types';
import { scenarios } from '../data';
import {
  applyAction,
  changeSector,
  finishShift,
  createState,
  issueCommand,
  makeReplay,
  replayTo,
  step,
} from '../simulation/engine';
import { validateReplay } from '../persistence/validation';
import { FixedStepScheduler } from '../simulation/clock';
let state: SimulationState | null = null,
  initial: SimulationState | null = null,
  replay: Replay | null = null,
  last = performance.now(),
  checkpoints: Replay['checkpoints'] = [];
const scheduler = new FixedStepScheduler();
const send = (message: WorkerResponse) => postMessage(message);
const publish = () => {
  if (state)
    send({ type: 'STATE', state, replaying: !!replay, replayFinalTick: replay?.finalTick });
};
self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  try {
    const m = e.data;
    switch (m.type) {
      case 'START': {
        const scenario = scenarios.find((s) => s.id === m.scenarioId);
        if (!scenario) throw Error('Unknown scenario.');
        state = createState(scenario, m.seed, m.density, m.duration);
        initial = structuredClone(state);
        replay = null;
        checkpoints = [];
        scheduler.reset();
        last = performance.now();
        break;
      }
      case 'COMMAND':
        if (state && !replay)
          send({ type: 'RESULT', result: issueCommand(state, m.intent, m.source) });
        break;
      case 'PAUSE':
        if (state) state.clock.paused = !state.clock.paused;
        scheduler.reset();
        break;
      case 'SPEED':
        if (state && [0.5, 1, 2, 4].includes(m.speed)) state.clock.speed = m.speed;
        break;
      case 'SECTOR':
        if (state && !replay) changeSector(state, m.sector, m.combine);
        break;
      case 'FINISH':
        if (state && !replay) finishShift(state);
        break;
      case 'EXPORT_REPLAY':
        if (state && initial)
          send({ type: 'REPLAY_DATA', replay: makeReplay(initial, state, checkpoints) });
        break;
      case 'REPLAY':
        validateReplay(m.replay);
        const restored = replayTo(m.replay, 0);
        replay = m.replay;
        state = restored;
        state.clock.paused = true;
        initial = structuredClone(state);
        scheduler.reset();
        break;
      case 'SEEK':
        if (replay) {
          state = replayTo(replay, m.tick);
          state.clock.paused = true;
          scheduler.reset();
        }
        break;
    }
    publish();
  } catch (error) {
    send({ type: 'ERROR', message: error instanceof Error ? error.message : 'Simulation failed.' });
  }
};
setInterval(() => {
  const now = performance.now(),
    elapsed = (now - last) / 1000;
  last = now;
  if (!state) return;
  try {
    const count = scheduler.advance(
      elapsed,
      state.clock.speed,
      state.clock.paused || state.complete,
      () => {
        if (!state) return false;
        if (replay) {
          for (const action of replay.actions.slice(state.actions.length)) {
            if (action.tick !== state.clock.tick) break;
            applyAction(state, action);
          }
          if (state.clock.tick >= replay.finalTick || state.complete) {
            state.clock.paused = true;
            return false;
          }
          step(state);
          for (const action of replay.actions.slice(state.actions.length)) {
            if (action.tick !== state.clock.tick) break;
            applyAction(state, action);
          }
        } else {
          step(state);
          if (state.clock.tick % 240 === 0)
            checkpoints.push({ tick: state.clock.tick, state: structuredClone(state) });
        }
        return !state.complete;
      },
    );
    if (count) publish();
  } catch (error) {
    state.clock.paused = true;
    send({ type: 'ERROR', message: `Simulation paused: ${String(error)}` });
  }
}, 50);
