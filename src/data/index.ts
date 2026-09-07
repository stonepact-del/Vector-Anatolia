import type {
  AIRACDataset,
  AircraftPerformanceProvider,
  AircraftPerformanceProfile,
  AircraftType,
  AirspaceDataProvider,
  NavigationDataProvider,
  ProcedureDataProvider,
  RuleProvenance,
  Scenario,
  Sector,
  TrafficFlow,
} from '../domain/types';
const source = (
  ruleId: string,
  document: string,
  section: string,
  notes: string,
): RuleProvenance => ({
  ruleId,
  authority: 'DHMİ',
  document,
  section,
  sourceUrl: `https://www.dhmi.gov.tr/AIPDocuments/LT_${document.replaceAll(' ', '_')}_en.pdf`,
  effectiveDate: null,
  verifiedDate: '2026-09-07',
  fidelity: 'MODELED',
  notes:
    notes +
    ' Source text inspected; complete 2026 amendment applicability not established. Implemented as a modeled rule, not current operational guidance.',
});
export const rules: RuleProvenance[] = [
  source('HORIZONTAL', 'ENR 1 6', '4.1', 'Published radar minimum: 5 NM.'),
  source(
    'VERTICAL',
    'ENR 1 7',
    '3.2',
    'Published RVSM concept: 1,000 ft, FL290–FL410 inclusive. Non-RVSM treatment conservatively modeled.',
  ),
  source(
    'IDENTIFICATION',
    'ENR 1 6',
    '3',
    'SSR identification and radar contact concepts; automatic identity correlation is simplified.',
  ),
  source(
    'FRA',
    'ENR 1 3',
    '5',
    '27 NOV 2025 source snapshot: 20:00–02:00 UTC, FL305–FL660; designated points. Synthetic routes are not official FRA routes.',
  ),
  source(
    'COMMS',
    'ENR 1 6',
    '7',
    'Radio failure blocks simulator clearance delivery. Last accepted intent is retained; not a complete radio-failure procedure.',
  ),
  {
    ruleId: 'STCA',
    authority: 'EUROCONTROL',
    document: 'Guidelines for STCA',
    section: 'Concept and requirements',
    sourceUrl:
      'https://www.eurocontrol.int/publication/eurocontrol-guidelines-short-term-conflict-alert-stca',
    effectiveDate: '2017-01-18',
    verifiedDate: '2026-09-07',
    fidelity: 'MODELED',
    notes:
      'Public safety-net concept. 120-second horizon and alert logic are original simulator parameters, not DHMİ thresholds.',
  },
  ...['PERFORMANCE', 'WEATHER', 'WORKLOAD', 'HANDOFF', 'READBACK', 'EMERGENCY', 'LEVELS'].map(
    (ruleId) => ({
      ruleId,
      authority: 'ANKARA CONTROL',
      document: 'Simulation model',
      section: ruleId,
      sourceUrl: './docs/simulation-model.md',
      effectiveDate: '2026-09-07',
      verifiedDate: null,
      fidelity: 'MODELED' as const,
      notes: 'Original entertainment simulation model. Not certified operational data.',
    }),
  ),
];
const names = ['MARMARA', 'WEST', 'CENTRAL', 'EAST', 'AEGEAN', 'LAKES', 'TAURUS', 'UPPER EAST'];
const sectors: Sector[] = names.map((name, i) => {
  const col = i % 4,
    row = Math.floor(i / 4),
    x = col * 200,
    y = row * 190;
  return {
    id: `S${i + 1}`,
    name,
    polygon: [
      { x, y },
      { x: x + 200, y },
      { x: x + 200, y: y + 190 },
      { x, y: y + 190 },
    ],
    center: { x: x + 100, y: y + 95 },
    layers: [
      { id: 'LOW', lowerFt: 14000, upperFt: 30500 },
      { id: 'HIGH', lowerFt: 30500, upperFt: 46000 },
    ],
    adjacent: names
      .map((_, j) => j)
      .filter((j) => Math.abs((j % 4) - col) + Math.abs(Math.floor(j / 4) - row) === 1)
      .map((j) => `S${j + 1}`),
    open: true,
  };
});
export const dataset: AIRACDataset = {
  id: 'ANATOLIA-SIM',
  version: '1.0.0',
  contentHash: 'anatolia-original-grid-v1',
  effectiveDate: '2025-11-27',
  synthetic: true,
  sectors,
  firs: [
    {
      id: 'LTAA-SIM',
      name: 'Ankara inspired region',
      synthetic: true,
      sectors: ['S2', 'S3', 'S4', 'S6', 'S7', 'S8'],
    },
    { id: 'LTBB-SIM', name: 'Istanbul inspired region', synthetic: true, sectors: ['S1', 'S5'] },
  ],
  waypoints: [
    { id: 'SIMWA', x: 5, y: 90, role: 'ENTRY' },
    { id: 'SIMWB', x: 5, y: 290, role: 'ENTRY' },
    { id: 'SIMNA', x: 305, y: 5, role: 'ENTRY' },
    { id: 'SIMNB', x: 495, y: 5, role: 'ENTRY' },
    { id: 'SIMEA', x: 795, y: 90, role: 'EXIT' },
    { id: 'SIMEB', x: 795, y: 290, role: 'EXIT' },
    { id: 'SIMSA', x: 305, y: 375, role: 'EXIT' },
    { id: 'SIMSB', x: 495, y: 375, role: 'EXIT' },
    { id: 'SIMMA', x: 95, y: 95, role: 'INTERMEDIATE' },
    { id: 'SIMLA', x: 290, y: 95, role: 'INTERMEDIATE' },
    { id: 'SIMCA', x: 495, y: 95, role: 'INTERMEDIATE' },
    { id: 'SIMDA', x: 695, y: 95, role: 'INTERMEDIATE' },
    { id: 'SIMMB', x: 95, y: 285, role: 'INTERMEDIATE' },
    { id: 'SIMLB', x: 290, y: 285, role: 'CONNECTING' },
    { id: 'SIMCB', x: 495, y: 285, role: 'CONNECTING' },
    { id: 'SIMDB', x: 695, y: 285, role: 'INTERMEDIATE' },
    { id: 'SIMAX', x: 355, y: 165, role: 'INTERMEDIATE' },
    { id: 'SIMBX', x: 445, y: 215, role: 'INTERMEDIATE' },
  ],
  rules,
  fra: {
    effectiveDate: '2025-11-27',
    startHour: 20,
    endHour: 2,
    lowerFt: 30500,
    upperFt: 66000,
    fidelity: 'MODELED',
  },
};
const specs: [
  string,
  AircraftPerformanceProfile['category'],
  number,
  number,
  number,
  number,
  number,
][] = [
  ['RJ', 'REGIONAL', 420, 2200, 2500, 39000, 0.82],
  ['NB', 'NARROWBODY', 450, 1900, 2200, 41000, 0.84],
  ['WB', 'WIDEBODY', 480, 1500, 2000, 43000, 0.89],
  ['HV', 'HEAVY', 480, 1200, 1700, 43000, 0.89],
  ['TP', 'TURBOPROP', 280, 1300, 1600, 25000, 0.55],
];
export const profiles: AircraftPerformanceProfile[] = specs.map(
  ([id, category, cruiseTas, climbFpm, descendFpm, ceilingFt, maxMach]) => ({
    id,
    category,
    cruiseTas,
    climbFpm,
    descendFpm,
    ceilingFt,
    maxMach,
    turnDegSec: category === 'HEAVY' ? 1.1 : 1.7,
    accelerationKtSec: category === 'TURBOPROP' ? 1 : 0.65,
    minIas: category === 'TURBOPROP' ? 150 : 210,
    maxIas: category === 'TURBOPROP' ? 270 : 340,
    responseTicks: 12,
    fidelity: 'MODELED',
  }),
);
export const aircraftTypes: AircraftType[] = [
  ['A320', 'Airbus A320', 'NB'],
  ['A321', 'Airbus A321', 'NB'],
  ['B738', 'Boeing 737-800', 'NB'],
  ['B38M', 'Boeing 737 MAX 8', 'NB'],
  ['A333', 'Airbus A330-300', 'WB'],
  ['B789', 'Boeing 787-9', 'WB'],
  ['B77W', 'Boeing 777-300ER', 'HV'],
  ['A359', 'Airbus A350-900', 'WB'],
  ['E190', 'Embraer 190', 'RJ'],
  ['AT76', 'ATR 72-600', 'TP'],
].map(([id, name, profileId]) => ({
  id,
  name,
  profileId,
  wake: profileId === 'WB' || profileId === 'HV' ? 'H' : 'M',
}));
export const performance = (type: string) =>
  profiles.find((p) => p.id === aircraftTypes.find((t) => t.id === type)?.profileId)!;
export const flows: TrafficFlow[] = [
  [
    'EU_TR',
    'Europe ↔ Türkiye',
    ['EDDF', 'EGLL', 'EHAM'],
    ['LTFM', 'LTAC'],
    ['SIMWA', 'SIMMA', 'SIMLA', 'SIMCA', 'SIMEA'],
  ],
  [
    'DOM',
    'Türkiye domestic',
    ['LTFM', 'LTAC'],
    ['LTAI', 'LTBJ'],
    ['SIMNA', 'SIMLA', 'SIMLB', 'SIMSA'],
  ],
  [
    'EU_ME',
    'Europe ↔ Middle East',
    ['LFPG', 'EDDM'],
    ['OTHH', 'OMDB'],
    ['SIMWA', 'SIMLA', 'SIMAX', 'SIMCB', 'SIMEB'],
  ],
  [
    'TR_ME',
    'Türkiye ↔ Middle East',
    ['LTFM', 'LTAI'],
    ['OERK', 'OTHH'],
    ['SIMWB', 'SIMLB', 'SIMBX', 'SIMDB', 'SIMEB'],
  ],
  [
    'TR_AS',
    'Türkiye ↔ Asia',
    ['LTFM', 'LTAC'],
    ['VIDP', 'UTTT'],
    ['SIMWA', 'SIMLA', 'SIMCA', 'SIMDA', 'SIMEA'],
  ],
  [
    'HUB',
    'Istanbul hub',
    ['LTFM'],
    ['LTAC', 'OMDB', 'EDDF'],
    ['SIMNA', 'SIMLA', 'SIMAX', 'SIMCB', 'SIMSB'],
  ],
  [
    'SUMMER',
    'Antalya seasonal',
    ['EGKK', 'EDDL'],
    ['LTAI'],
    ['SIMNB', 'SIMCA', 'SIMBX', 'SIMLB', 'SIMSA'],
  ],
  [
    'TRANSIT',
    'Transit overflights',
    ['LOWW', 'LROP'],
    ['OIII', 'OMAA'],
    ['SIMWA', 'SIMMA', 'SIMCA', 'SIMDA', 'SIMEA'],
  ],
  [
    'NIGHT',
    'Night FRA',
    ['EDDF', 'EHAM'],
    ['OTHH', 'VIDP'],
    ['SIMWB', 'SIMLB', 'SIMCB', 'SIMDB', 'SIMEB'],
  ],
].map(([id, name, origins, destinations, route]) => ({
  id: id as string,
  name: name as string,
  origins: origins as string[],
  destinations: destinations as string[],
  routes: [route as string[]],
  weight: 1,
}));
const base = {
  durationSec: 900,
  initialTraffic: 8,
  spawnIntervalSec: 65,
  seed: 2609,
  startUtcHour: 12,
  weather: false,
  events: [],
  tutorial: false,
  conflict: false,
  fra: false,
  difficulty: 1,
};
export const scenarios: Scenario[] = [
  {
    ...base,
    id: 'tutorial',
    name: 'QUIET SECTOR',
    subtitle: '01 / RADAR ORIENTATION',
    description:
      'Learn the scope, identify traffic, issue clearances and coordinate a transfer. One concept at a time.',
    initialTraffic: 3,
    spawnIntervalSec: 240,
    tutorial: true,
    difficulty: 0,
  },
  {
    ...base,
    id: 'normal',
    name: 'NORMAL OPS',
    subtitle: '02 / CENTRAL ANATOLIA',
    description:
      'A measured mix of domestic services and international crossings. Keep the flow moving.',
  },
  {
    ...base,
    id: 'istanbul',
    name: 'ISTANBUL FLOW',
    subtitle: '03 / HUB CONNECTIONS',
    description:
      'Converging arrivals and departures bring changing levels and closely spaced transfers.',
    initialTraffic: 12,
    spawnIntervalSec: 45,
  },
  {
    ...base,
    id: 'summer',
    name: 'SUMMER RUSH',
    subtitle: '04 / SOUTHBOUND',
    description: 'Seasonal traffic compresses the southern routes. Anticipate before you transmit.',
    initialTraffic: 16,
    spawnIntervalSec: 35,
    difficulty: 2,
  },
  {
    ...base,
    id: 'transit',
    name: 'TRANSIT WAVE',
    subtitle: '05 / CROSSING STREAMS',
    description:
      'Long-haul crossings create a developing conflict. Use level, heading or speed to resolve it.',
    initialTraffic: 12,
    conflict: true,
    difficulty: 2,
  },
  {
    ...base,
    id: 'weather',
    name: 'THUNDERSTORM DEVIATIONS',
    subtitle: '06 / CONVECTIVE ACTIVITY',
    description:
      'Cells obstruct the usual routes. Respond to deviation requests and watch the compressed flow.',
    weather: true,
    events: [{ atSec: 30, kind: 'WEATHER', aircraftIndex: 0 }],
    difficulty: 2,
  },
  {
    ...base,
    id: 'comms',
    name: 'COMMUNICATION FAILURE',
    subtitle: '07 / ABNORMAL OPERATIONS',
    description:
      'A flight stops responding. Protect its last accepted trajectory and coordinate surrounding traffic.',
    events: [{ atSec: 35, kind: 'COMMS', aircraftIndex: 0 }],
    difficulty: 2,
  },
  {
    ...base,
    id: 'medical',
    name: 'MEDICAL DIVERSION',
    subtitle: '08 / PRIORITY TRAFFIC',
    description:
      'A medical urgency requires a new destination and route. Create space for the diversion.',
    events: [{ atSec: 35, kind: 'MEDICAL', aircraftIndex: 0 }],
    difficulty: 2,
  },
  {
    ...base,
    id: 'overload',
    name: 'SECTOR OVERLOAD',
    subtitle: '09 / HIGH WORKLOAD',
    description:
      'Dense inbound traffic tests planning and handoff discipline. Safety comes before throughput.',
    initialTraffic: 24,
    spawnIntervalSec: 25,
    conflict: true,
    difficulty: 3,
  },
  {
    ...base,
    id: 'fra',
    name: 'NIGHT FRA',
    subtitle: '10 / FREE ROUTE AIRSPACE',
    description:
      'Cross the 20:00 UTC activation in a dated, modeled FRATURK scenario. Direct segments reshape the flow.',
    startUtcHour: 19 + 59 / 60,
    initialTraffic: 10,
    fra: true,
    difficulty: 2,
  },
];
export const providers: {
  airspace: AirspaceDataProvider;
  navigation: NavigationDataProvider;
  procedures: ProcedureDataProvider;
  performance: AircraftPerformanceProvider;
} = {
  airspace: { load: () => structuredClone(dataset) },
  navigation: { waypoints: () => structuredClone(dataset.waypoints) },
  procedures: {
    rules: () => rules,
    separation: () => ({
      id: 'SIM-ACC',
      horizontalNm: 5,
      rvsmFt: 1000,
      nonRvsmFt: 2000,
      provenanceIds: ['HORIZONTAL', 'VERTICAL'],
    }),
  },
  performance: { types: () => aircraftTypes, profiles: () => profiles },
};
