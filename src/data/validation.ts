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
  validateSimulationConfiguration(value);
  const ids = new Set<string>();
  for (const w of value.waypoints) {
    if (ids.has(w.id) || ![w.x, w.y].every(Number.isFinite))
      throw Error('Invalid or duplicate navigation fix.');
    ids.add(w.id);
  }
  if (
    !value.fra ||
    !Number.isFinite(Date.parse(value.fra.effectiveDate + 'T00:00:00Z')) ||
    ![value.fra.startHour, value.fra.endHour, value.fra.lowerFt, value.fra.upperFt].every(
      Number.isFinite,
    )
  )
    throw Error('Invalid FRA applicability configuration.');
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

export function validateSimulationConfiguration(data: AIRACDataset) {
  if (
    !data.simulation ||
    !data.sectors.some((s) => s.id === data.simulation.initialSector) ||
    !data.separation ||
    ![data.separation.horizontalNm, data.separation.rvsmFt, data.separation.nonRvsmFt].every(
      (n) => Number.isFinite(n) && n > 0,
    )
  )
    throw Error('Missing simulation configuration or separation rules.');
  const b = data.simulation.bounds;
  if (!b || !Object.values(b).every(Number.isFinite) || b.maxX <= b.minX || b.maxY <= b.minY)
    throw Error('Invalid simulation bounds.');
  if (
    !Array.isArray(data.simulation.geographicOutline) ||
    !data.simulation.geographicOutline.length ||
    data.simulation.geographicOutline.some(
      (ring) => ring.length < 3 || ring.some((p) => ![p.x, p.y].every(Number.isFinite)),
    ) ||
    !data.simulation.geographicSource?.name ||
    !data.simulation.geographicSource.license ||
    !Array.isArray(data.simulation.landmarks) ||
    data.simulation.landmarks.some(
      (l) => !l.id || !l.name || ![l.position.x, l.position.y].every(Number.isFinite),
    )
  )
    throw Error('Invalid or unlicensed geographic base configuration.');
  if (
    !Array.isArray(data.trafficFlows) ||
    !data.trafficFlows.length ||
    !Array.isArray(data.aircraftTypes) ||
    data.aircraftTypes.length < 2 ||
    !Array.isArray(data.performanceProfiles) ||
    !data.performanceProfiles.length
  )
    throw Error('Dataset requires traffic and aircraft providers.');
  const fixes = new Set(data.waypoints.map((w) => w.id));
  if (!fixes.has(data.simulation.medicalFix)) throw Error('Unknown medical diversion fix.');
  for (const f of data.trafficFlows) {
    if (
      !f.origins.length ||
      !f.destinations.length ||
      !f.routes.length ||
      f.routes.some((r) => r.length < 2 || r.some((id) => !fixes.has(id)))
    )
      throw Error('Traffic route references an unknown fix.');
  }
  for (const o of data.simulation.orientationFlights) {
    if (
      ![o.position.x, o.position.y].every(Number.isFinite) ||
      o.nextWaypoint < 0 ||
      o.nextWaypoint >= o.route.length ||
      o.route.some((id) => !fixes.has(id))
    )
      throw Error('Invalid orientation flight.');
  }
  for (const t of data.aircraftTypes)
    if (!data.performanceProfiles.some((p) => p.id === t.profileId))
      throw Error('Missing aircraft performance profile.');
  for (const p of data.performanceProfiles)
    if (
      ![
        p.cruiseTas,
        p.climbFpm,
        p.descendFpm,
        p.ceilingFt,
        p.maxMach,
        p.turnDegSec,
        p.accelerationKtSec,
        p.minIas,
        p.maxIas,
      ].every((n) => Number.isFinite(n) && n > 0)
    )
      throw Error('Invalid performance envelope.');
}
