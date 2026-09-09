import type { SimulationState, TrafficPhase } from '../domain/types';

export function trafficPhase(s: SimulationState): TrafficPhase {
  const ratio = (s.clock.tick * s.clock.stepSec) / s.scenario.durationSec;
  if (ratio < 0.15) return 'QUIET';
  if (ratio < 0.35) return 'BUILDING';
  if (ratio < 0.58) return 'BUSY';
  if (ratio < 0.78) return 'PEAK';
  return 'RECOVERY';
}

const multiplier: Record<TrafficPhase, number> = {
  QUIET: 0.65,
  BUILDING: 1,
  BUSY: 1.35,
  PEAK: 1.65,
  RECOVERY: 0.55,
};

export function scheduleNextSpawn(s: SimulationState) {
  s.trafficPhase = trafficPhase(s);
  const baseTicks = s.scenario.spawnIntervalSec / s.clock.stepSec;
  const jitter = 0.88 + ((s.rng % 100) / 100) * 0.24;
  s.nextSpawnTick =
    s.clock.tick + Math.max(8, Math.round((baseTicks * jitter) / multiplier[s.trafficPhase]));
  s.trafficDemand.entryRate = {
    intervalSec: (s.nextSpawnTick - s.clock.tick) * s.clock.stepSec,
    nextTick: s.nextSpawnTick,
  };
  s.trafficDemand.flowPressure = s.dataset.trafficFlows.map((flow, index) => ({
    flowId: flow.id,
    value: Number(
      (
        flow.weight *
        multiplier[s.trafficPhase] *
        ((s.scenario.id === 'istanbul' && flow.id === 'HUB') ||
        (s.scenario.id === 'summer' && flow.id === 'SUMMER') ||
        (s.scenario.fra && flow.id === 'NIGHT')
          ? 2.4
          : 1)
      ).toFixed(3),
    ),
  }));
}
