import type { AIRACDataset, Aircraft, Route } from '../domain/types';
import { distance } from './math';
export function validateFraRoute(
  route: Route,
  a: Aircraft,
  data: AIRACDataset,
  utcMs: number,
): string | null {
  const hour = (((utcMs / 3600000) % 24) + 24) % 24;
  const cfg = data.fra;
  if (!(hour >= cfg.startHour || hour < cfg.endHour)) return 'FRA inactive at this scenario time.';
  if (a.altitudeFt < cfg.lowerFt || a.altitudeFt > cfg.upperFt)
    return 'Outside FRA vertical applicability.';
  if (!a.flightPlan.rvsm) return 'Synthetic FRA eligibility requires RVSM-capable traffic.';
  if (route.waypoints.length < 2) return 'An entry and exit are required.';
  const points = route.waypoints.map((id) => data.waypoints.find((w) => w.id === id));
  if (points.some((p) => !p)) return 'FRA requires designated dataset points.';
  // The rectangular synthetic network supplies a conservative interior corridor.
  // The entry/exit connection legs may touch the boundary; intermediate segments must stay 5 NM inside.
  for (let i = 1; i < points.length - 2; i++) {
    for (const p of [points[i]!, points[i + 1]!])
      if (p.x < 5 || p.x > 795 || p.y < 5 || p.y > 375)
        return 'Intermediate FRA segments must remain 5 NM inside the synthetic boundary.';
  }
  if (points.some((p, i) => i > 0 && distance(p!, points[i - 1]!) === 0))
    return 'Duplicate consecutive FRA points.';
  return null;
}
