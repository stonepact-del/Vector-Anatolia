import type { AIRACDataset, Aircraft, Point } from '../domain/types';
import { distance, move, sectorAt, vector } from './math';
/** Sample the intended path until its first geographic sector crossing, not its distant exit fix. */
export function nextSectorAlongIntent(a: Aircraft, data: AIRACDataset): string | null {
  const endpoints: Point[] =
    a.navigationMode === 'HEADING'
      ? [move(a.position, vector(a.assignedHeadingDeg ?? a.trackDeg, 3600), 900)]
      : a.routeIntent
          .slice(a.nextWaypoint)
          .map((id) => data.waypoints.find((w) => w.id === id))
          .filter((p): p is NonNullable<typeof p> => !!p);
  let from = a.position;
  for (const to of endpoints) {
    const length = distance(from, to),
      steps = Math.max(1, Math.ceil(length / 2));
    for (let i = 1; i <= steps; i++) {
      const point = {
        x: from.x + ((to.x - from.x) * i) / steps,
        y: from.y + ((to.y - from.y) * i) / steps,
      };
      const sector = sectorAt(point, data.sectors, a.sectorId);
      if (sector && sector.id !== a.sectorId) return sector.id;
    }
    from = to;
  }
  return null;
}
