import type { Point, Sector } from '../domain/types';
export const STEP = 0.25;
export const mod = (n: number, m: number) => ((n % m) + m) % m;
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const bearing = (a: Point, b: Point) =>
  mod((Math.atan2(b.x - a.x, a.y - b.y) * 180) / Math.PI, 360);
export const deltaHeading = (from: number, to: number) => mod(to - from + 180, 360) - 180;
export const vector = (heading: number, speedKt: number): Point => ({
  x: (Math.sin((heading * Math.PI) / 180) * speedKt) / 3600,
  y: (-Math.cos((heading * Math.PI) / 180) * speedKt) / 3600,
});
export const move = (p: Point, v: Point, sec: number): Point => ({
  x: p.x + v.x * sec,
  y: p.y + v.y * sec,
});
export function contains(p: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    const cross = (p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x);
    if (
      Math.abs(cross) < 1e-8 &&
      p.x >= Math.min(a.x, b.x) &&
      p.x <= Math.max(a.x, b.x) &&
      p.y >= Math.min(a.y, b.y) &&
      p.y <= Math.max(a.y, b.y)
    )
      return true;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}
export const sectorAt = (p: Point, sectors: Sector[], previous?: string) =>
  sectors.find((s) => s.id === previous && contains(p, s.polygon)) ??
  sectors.find((s) => contains(p, s.polygon));
export function haversineNm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 3440.065 * 2 * Math.asin(Math.sqrt(clamp(h, 0, 1)));
}
export function nextRandom(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) >>> 0;
  const state = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [state, ((t ^ (t >>> 14)) >>> 0) / 4294967296];
}
export function hash(value: unknown): string {
  const text = JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
// Local synthetic plane is expressed in nautical miles, not certified geodesy.
export const densityRatio = (altFt: number) =>
  Math.pow(Math.max(0.24, 1 - 6.87535e-6 * Math.min(altFt, 36089)), 4.2561) *
  (altFt > 36089 ? Math.exp(-(altFt - 36089) / 20806) : 1);
export const tasFromIas = (ias: number, alt: number) => ias / Math.sqrt(densityRatio(alt));
export const iasFromTas = (tas: number, alt: number) => tas * Math.sqrt(densityRatio(alt));
export const soundSpeed = (alt: number) =>
  661.47 * Math.sqrt(Math.max(216.65, 288.15 - alt * 0.0019812) / 288.15);
