import type { Aircraft, Clearance } from '../domain/types';
/** Shared by actual execution and the trajectory predictor. Ownership has no motion side effects. */
export function applyMotionIntent(a: Aircraft, c: Pick<Clearance, 'kind' | 'value'>): void {
  const value = c.value;
  switch (c.kind) {
    case 'CLIMB':
    case 'DESCEND':
    case 'LEVEL':
      a.clearedAltitudeFt = Number(value);
      a.flightPlan.assignedCruiseFt = Number(value);
      break;
    case 'HEADING':
      a.assignedHeadingDeg = Number(value) % 360;
      a.navigationMode = 'HEADING';
      break;
    case 'DIRECT': {
      const index = a.routeIntent.indexOf(String(value), a.nextWaypoint);
      if (index >= 0) a.nextWaypoint = index;
      else {
        a.routeIntent = [String(value), a.flightPlan.exitPoint];
        a.nextWaypoint = 0;
      }
      a.navigationMode = 'ROUTE';
      a.assignedHeadingDeg = null;
      break;
    }
    case 'RESUME':
      a.navigationMode = 'ROUTE';
      a.assignedHeadingDeg = null;
      break;
    case 'SPEED':
    case 'MACH':
      a.assignedSpeed = { unit: c.kind === 'SPEED' ? 'IAS' : 'MACH', value: Number(value) };
      break;
  }
}
