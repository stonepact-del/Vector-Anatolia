import type { AIRACDataset } from '../domain/types';
export function validateDataset(value: AIRACDataset): void {
  if (
    !value ||
    !value.id ||
    !value.version ||
    !value.contentHash ||
    !Array.isArray(value.sectors) ||
    !value.sectors.length ||
    !Array.isArray(value.waypoints) ||
    !value.waypoints.length
  )
    throw Error('Missing or invalid airspace dataset.');
  const ids = new Set<string>();
  for (const w of value.waypoints) {
    if (ids.has(w.id) || ![w.x, w.y].every(Number.isFinite))
      throw Error('Invalid or duplicate navigation fix.');
    ids.add(w.id);
  }
  const sectors = new Set(value.sectors.map((s) => s.id));
  if (sectors.size !== value.sectors.length) throw Error('Duplicate sector identifier.');
  for (const s of value.sectors) {
    if (
      s.polygon.length < 3 ||
      s.polygon.some((p) => ![p.x, p.y].every(Number.isFinite)) ||
      s.adjacent.some((id) => !sectors.has(id))
    )
      throw Error('Invalid sector geometry or adjacency.');
    for (const layer of s.layers)
      if (
        !Number.isFinite(layer.lowerFt) ||
        !Number.isFinite(layer.upperFt) ||
        layer.lowerFt >= layer.upperFt
      )
        throw Error('Invalid vertical sector layer.');
  }
}
