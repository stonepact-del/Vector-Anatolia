import type { AIRACDataset, Aircraft, Route } from '../domain/types';
import { distance } from './math';
export function fraWindowActive(utcMs: number, altitude: number, data: AIRACDataset): boolean {
  const cfg = data.fra;
  const hour = (((utcMs / 3600000) % 24) + 24) % 24;
  const effective = Date.parse(cfg.effectiveDate + 'T00:00:00Z');
  const within =
    cfg.startHour < cfg.endHour
      ? hour >= cfg.startHour && hour < cfg.endHour
      : hour >= cfg.startHour || hour < cfg.endHour;
  return utcMs >= effective && within && altitude >= cfg.lowerFt && altitude <= cfg.upperFt;
}
export function validateFraRoute(
  route: Route,
  a: Aircraft,
  data: AIRACDataset,
  utcMs: number,
): string | null {
  const cfg = data.fra;
  if (!fraWindowActive(utcMs, cfg.lowerFt, data)) return 'FRA inactive at this scenario time.';
  if (a.altitudeFt < cfg.lowerFt || a.altitudeFt > cfg.upperFt)
    return 'Outside FRA vertical applicability.';
  if (!a.flightPlan.rvsm) return 'Synthetic FRA eligibility requires RVSM-capable traffic.';
  if (route.waypoints.length < 2) return 'An entry and exit are required.';
  const points = route.waypoints.map((id) => data.waypoints.find((w) => w.id === id));
  if (points.some((p) => !p)) return 'FRA requires designated dataset points.';
  if (!['ENTRY', 'ENTRY_EXIT', 'CONNECTING'].includes(points[0]!.role))
    return 'FRA route requires a designated entry or connecting point.';
  if (!['EXIT', 'ENTRY_EXIT', 'CONNECTING'].includes(points.at(-1)!.role))
    return 'FRA route requires a designated exit or connecting point.';
  if (points.slice(1, -1).some((p) => !['INTERMEDIATE', 'CONNECTING'].includes(p!.role)))
    return 'FRA interior routing requires intermediate or connecting points.';
  // The rectangular synthetic network supplies a conservative interior corridor.
  // The entry/exit connection legs may touch the boundary; intermediate segments must stay 5 NM inside.
  for (const p of points.slice(1, -1))
    if (
      p!.x < data.simulation.bounds.minX + 5 ||
      p!.x > data.simulation.bounds.maxX - 5 ||
      p!.y < data.simulation.bounds.minY + 5 ||
      p!.y > data.simulation.bounds.maxY - 5
    )
      return 'Intermediate FRA segments must remain 5 NM inside the synthetic boundary.';
  if (points.some((p, i) => i > 0 && distance(p!, points[i - 1]!) === 0))
    return 'Duplicate consecutive FRA points.';
  return null;
}
