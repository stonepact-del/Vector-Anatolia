import type { Aircraft, AIRACDataset, Conflict, Point } from '../domain/types';
import { applyMotionIntent } from './intent';
import { advanceAircraft } from './aircraft';
import { clamp, distance } from './math';
export const HORIZONTAL_NM = 5,
  PREDICTION_SECONDS = 300,
  STCA_SECONDS = 120;
export function verticalMinimumValues(altA: number, altB: number, rvsmA: boolean, rvsmB: boolean) {
  const low = Math.min(altA, altB),
    high = Math.max(altA, altB);
  if (high < 29000) return 1000;
  if (low >= 29000 && high <= 41000 && rvsmA && rvsmB) return 1000;
  return 2000;
}
export function verticalMinimum(a: Aircraft, b: Aircraft) {
  return verticalMinimumValues(a.altitudeFt, b.altitudeFt, a.flightPlan.rvsm, b.flightPlan.rvsm);
}
export function separated(a: Aircraft, b: Aircraft) {
  return (
    distance(a.position, b.position) >= HORIZONTAL_NM ||
    Math.abs(a.altitudeFt - b.altitudeFt) >= verticalMinimum(a, b)
  );
}
interface Sample {
  p: Point;
  alt: number;
}
function samples(aircraft: Aircraft, data: AIRACDataset, tick: number): Sample[] {
  const a = structuredClone(aircraft);
  const queued = a.history.filter((h) => h.status === 'QUEUED');
  a.history = [];
  a.trail = [];
  const result: Sample[] = [{ p: { ...a.position }, alt: a.altitudeFt }];
  for (let offset = 1; offset <= PREDICTION_SECONDS * 4; offset++) {
    for (const h of queued)
      if (h.executeTick === tick + offset && a.communication !== 'FAILED')
        applyMotionIntent(a, h.command);
    advanceAircraft(a, data, 0.25);
    if (offset % 20 === 0) result.push({ p: { ...a.position }, alt: a.altitudeFt });
  }
  return result;
}
// Swept relative segment, including vertical interpolation; catches crossings between prediction samples.
export function segmentBreach(
  a0: Sample,
  a1: Sample,
  b0: Sample,
  b1: Sample,
  vertical: number,
): { u: number; d: number; breach: boolean; entry: number } {
  const rx = a0.p.x - b0.p.x,
    ry = a0.p.y - b0.p.y,
    dx = a1.p.x - b1.p.x - rx,
    dy = a1.p.y - b1.p.y - ry;
  const aa = dx * dx + dy * dy;
  const u = aa > 1e-15 ? clamp(-(rx * dx + ry * dy) / aa, 0, 1) : 0;
  const d = Math.hypot(rx + dx * u, ry + dy * u);
  if (d >= HORIZONTAL_NM) return { u, d, breach: false, entry: 0 };
  let lo = 0,
    hi = 1;
  const bb = 2 * (rx * dx + ry * dy),
    cc = rx * rx + ry * ry - HORIZONTAL_NM ** 2;
  if (aa < 1e-15) {
    if (cc >= 0) return { u, d, breach: false, entry: 0 };
  } else {
    const disc = bb * bb - 4 * aa * cc;
    if (disc <= 0) return { u, d, breach: false, entry: 0 };
    lo = Math.max(lo, (-bb - Math.sqrt(disc)) / (2 * aa));
    hi = Math.min(hi, (-bb + Math.sqrt(disc)) / (2 * aa));
  }
  const z = a0.alt - b0.alt,
    dz = a1.alt - b1.alt - z;
  if (Math.abs(dz) < 1e-10) {
    if (Math.abs(z) >= vertical) return { u, d, breach: false, entry: 0 };
  } else {
    const t1 = (-vertical - z) / dz,
      t2 = (vertical - z) / dz;
    lo = Math.max(lo, Math.min(t1, t2));
    hi = Math.min(hi, Math.max(t1, t2));
  }
  return { u, d, breach: hi > lo && hi > 0 && lo < 1, entry: clamp(lo, 0, 1) };
}
export function predictConflicts(
  aircraft: Aircraft[],
  data: AIRACDataset,
  optimized = true,
  tick = 0,
): Conflict[] {
  const output: Conflict[] = [];
  const cache = new Map<string, Sample[]>();
  const bounds = new Map<string, { minX: number; maxX: number; minY: number; maxY: number }>();
  const get = (a: Aircraft) => {
    let v = cache.get(a.id);
    if (!v) {
      v = samples(a, data, tick);
      cache.set(a.id, v);
      bounds.set(a.id, {
        minX: Math.min(...v.map((s) => s.p.x)),
        maxX: Math.max(...v.map((s) => s.p.x)),
        minY: Math.min(...v.map((s) => s.p.y)),
        maxY: Math.max(...v.map((s) => s.p.y)),
      });
    }
    return v;
  };
  const buckets = new Map<string, Aircraft[]>();
  const cell = 120;
  for (const a of aircraft) {
    const key = `${Math.floor(a.position.x / cell)},${Math.floor(a.position.y / cell)}`;
    buckets.set(key, [...(buckets.get(key) ?? []), a]);
  }
  for (let i = 0; i < aircraft.length; i++) {
    const a = aircraft[i];
    let candidates = aircraft.slice(i + 1);
    if (optimized) {
      const cx = Math.floor(a.position.x / cell),
        cy = Math.floor(a.position.y / cell);
      candidates = [];
      for (let x = cx - 1; x <= cx + 1; x++)
        for (let y = cy - 1; y <= cy + 1; y++)
          for (const b of buckets.get(`${x},${y}`) ?? []) if (b.id > a.id) candidates.push(b);
    }
    for (const b of candidates) {
      const horizontal = distance(a.position, b.position);
      if (optimized && horizontal > 115) continue;
      const sa = get(a),
        sb = get(b);
      if (optimized) {
        const ba = bounds.get(a.id)!,
          bb = bounds.get(b.id)!;
        if (
          ba.maxX + 5 < bb.minX ||
          bb.maxX + 5 < ba.minX ||
          ba.maxY + 5 < bb.minY ||
          bb.maxY + 5 < ba.minY
        )
          continue;
      }
      let first = Infinity,
        closest = Infinity,
        closestT = 0,
        point = { ...a.position };
      for (let j = 0; j < sa.length - 1; j++) {
        const min = verticalMinimumValues(
          Math.max(sa[j].alt, sa[j + 1].alt),
          Math.max(sb[j].alt, sb[j + 1].alt),
          a.flightPlan.rvsm,
          b.flightPlan.rvsm,
        );
        const r = segmentBreach(sa[j], sa[j + 1], sb[j], sb[j + 1], min);
        if (r.breach && first === Infinity) first = j * 5 + r.entry * 5;
        if (r.d < closest) {
          closest = r.d;
          closestT = j * 5 + r.u * 5;
          point = { x: (sa[j].p.x + sb[j].p.x) / 2, y: (sa[j].p.y + sb[j].p.y) / 2 };
        }
      }
      if (first !== Infinity || !separated(a, b))
        output.push({
          id: [a.id, b.id].sort().join('/'),
          aircraftIds: [a.id, b.id],
          timeToConflictSec: !separated(a, b) ? 0 : first,
          closestTimeSec: closestT,
          closestDistanceNm: closest,
          point,
          actual: !separated(a, b),
          verticalFt: Math.abs(a.altitudeFt - b.altitudeFt),
          horizontalNm: horizontal,
        });
    }
  }
  return output.sort(
    (a, b) => a.timeToConflictSec - b.timeToConflictSec || a.id.localeCompare(b.id),
  );
}
