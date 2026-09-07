import type { Aircraft, AIRACDataset, Point } from '../domain/types';
import { performance } from '../data';
import {
  bearing,
  clamp,
  deltaHeading,
  distance,
  iasFromTas,
  mod,
  move,
  soundSpeed,
  tasFromIas,
  vector,
} from './math';
export function advanceAircraft(
  a: Aircraft,
  data: AIRACDataset,
  sec: number,
  wind: Point = { x: 12 / 3600, y: 0 },
): void {
  const p = performance(a.typeId);
  const wp = data.waypoints.find((w) => w.id === a.routeIntent[a.nextWaypoint]);
  if (a.navigationMode === 'ROUTE' && wp) {
    const reach = Math.max(1, (a.groundSpeedKt / 3600) * sec * 1.5);
    if (distance(a.position, wp) < reach) {
      a.nextWaypoint++;
    }
  }
  const target = data.waypoints.find((w) => w.id === a.routeIntent[a.nextWaypoint]);
  const heading =
    a.navigationMode === 'HEADING'
      ? (a.assignedHeadingDeg ?? a.headingDeg)
      : target
        ? bearing(a.position, target)
        : a.headingDeg;
  a.headingDeg = mod(
    a.headingDeg +
      clamp(deltaHeading(a.headingDeg, heading), -p.turnDegSec * sec, p.turnDegSec * sec),
    360,
  );
  const gap = a.clearedAltitudeFt - a.altitudeFt;
  const rate =
    (gap > 0 ? p.climbFpm : p.descendFpm) *
    (a.emergency.kind === 'PERFORMANCE' ? 0.45 : 1) *
    clamp(1 - (a.altitudeFt - 28000) / 60000, 0.55, 1.1);
  a.altitudeFt += clamp(gap, (-rate / 60) * sec, (rate / 60) * sec);
  a.verticalMode =
    Math.abs(a.clearedAltitudeFt - a.altitudeFt) < 1 ? 'LEVEL' : gap > 0 ? 'CLIMB' : 'DESCEND';
  const requestedTas = a.assignedSpeed
    ? a.assignedSpeed.unit === 'IAS'
      ? tasFromIas(a.assignedSpeed.value, a.altitudeFt)
      : a.assignedSpeed.value * soundSpeed(a.altitudeFt)
    : p.cruiseTas;
  const targetTas = Math.min(requestedTas, p.maxMach * soundSpeed(a.altitudeFt));
  a.tasKt += clamp(targetTas - a.tasKt, -p.accelerationKtSec * sec, p.accelerationKtSec * sec);
  a.iasKt = iasFromTas(a.tasKt, a.altitudeFt);
  a.mach = a.tasKt / soundSpeed(a.altitudeFt);
  const v = vector(a.headingDeg, a.tasKt);
  v.x += wind.x;
  v.y += wind.y;
  a.groundSpeedKt = Math.hypot(v.x, v.y) * 3600;
  a.trackDeg = bearing({ x: 0, y: 0 }, { x: v.x, y: v.y });
  const next = move(a.position, v, sec);
  a.distanceNm += distance(a.position, next);
  a.position = next;
}
