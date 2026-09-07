export type Fidelity = 'VERIFIED' | 'MODELED' | 'SIMPLIFIED' | 'UNKNOWN';
export interface RuleProvenance {
  ruleId: string;
  authority: string;
  document: string;
  section: string;
  sourceUrl: string;
  effectiveDate: string | null;
  verifiedDate: string | null;
  fidelity: Fidelity;
  notes: string;
}
export interface Point {
  x: number;
  y: number;
}
export interface Waypoint extends Point {
  id: string;
  role: 'ENTRY' | 'EXIT' | 'INTERMEDIATE' | 'CONNECTING';
}
export type Fix = Waypoint;
export interface RouteLeg {
  from: string;
  to: string;
  kind: 'AIRWAY' | 'DIRECT';
}
export interface Route {
  id: string;
  waypoints: string[];
  legs: RouteLeg[];
}
export interface FIR {
  id: string;
  name: string;
  synthetic: boolean;
  sectors: string[];
}
export interface SectorLayer {
  id: string;
  lowerFt: number;
  upperFt: number;
}
export interface Sector {
  id: string;
  name: string;
  polygon: Point[];
  layers: SectorLayer[];
  adjacent: string[];
  center: Point;
  open: boolean;
}
export interface ControlUnit {
  id: string;
  sectors: string[];
}
export interface ControllerPosition {
  id: string;
  sectorId: string;
}
export type AircraftControlState =
  | 'PLANNED'
  | 'INBOUND'
  | 'COORDINATED'
  | 'TRANSFER_PENDING'
  | 'ACCEPTED'
  | 'IDENTIFIED'
  | 'CONTROLLED'
  | 'TRANSFER_INITIATED'
  | 'TRANSFERRED'
  | 'RELEASED';
export type RadarIdentificationState = 'UNKNOWN' | 'CORRELATED' | 'IDENTIFIED' | 'LOST';
export type CommunicationState = 'CONTACT' | 'PENDING' | 'FAILED' | 'OTHER';
export type CoordinationState = 'NONE' | 'REQUESTED' | 'AGREED' | 'COMPLETE';
export interface Handoff {
  from: string | null;
  to: string;
  state: CoordinationState;
  initiatedTick: number;
  acceptedTick?: number;
}
export interface AircraftPerformanceProfile {
  id: string;
  category: 'REGIONAL' | 'NARROWBODY' | 'WIDEBODY' | 'HEAVY' | 'TURBOPROP';
  cruiseTas: number;
  climbFpm: number;
  descendFpm: number;
  turnDegSec: number;
  accelerationKtSec: number;
  ceilingFt: number;
  minIas: number;
  maxIas: number;
  maxMach: number;
  responseTicks: number;
  fidelity: 'MODELED';
}
export interface AircraftType {
  id: string;
  name: string;
  profileId: string;
  wake: 'M' | 'H';
}
export interface FlightPlan {
  origin: string;
  destination: string;
  entryPoint: string;
  exitPoint: string;
  route: Route;
  requestedCruiseFt: number;
  assignedCruiseFt: number;
  cruiseSpeed: number;
  rvsm: boolean;
  wake: 'M' | 'H';
  flowId: string;
}
export type ClearanceKind =
  | 'CLIMB'
  | 'DESCEND'
  | 'LEVEL'
  | 'HEADING'
  | 'DIRECT'
  | 'RESUME'
  | 'SPEED'
  | 'MACH'
  | 'ACCEPT'
  | 'IDENTIFY'
  | 'TRANSFER'
  | 'CONTACT'
  | 'ACKNOWLEDGE';
export interface Clearance {
  id: string;
  aircraftId: string;
  kind: ClearanceKind;
  value?: number | string;
  tick: number;
  sequence: number;
  source: 'UI' | 'TEXT' | 'REPLAY';
  actor: string;
}
export interface PilotReadback {
  clearanceId: string;
  state: 'CORRECT' | 'UNABLE' | 'CLARIFY' | 'CORRECTED' | 'EMERGENCY';
  text: string;
  tick: number;
}
export interface ClearanceHistory {
  command: Clearance;
  status: 'QUEUED' | 'EXECUTED' | 'REJECTED';
  message: string;
  executeTick?: number;
}
export interface EmergencyState {
  kind:
    | 'NONE'
    | 'MEDICAL'
    | 'COMMS'
    | 'MINIMUM_FUEL'
    | 'FUEL'
    | 'WEATHER'
    | 'PERFORMANCE'
    | 'NAVIGATION';
  declaredTick: number;
  acknowledged: boolean;
  resolved: boolean;
}
export interface Aircraft {
  id: string;
  callsign: string;
  typeId: string;
  position: Point;
  altitudeFt: number;
  clearedAltitudeFt: number;
  requestedAltitudeFt: number;
  headingDeg: number;
  trackDeg: number;
  assignedHeadingDeg: number | null;
  tasKt: number;
  iasKt: number;
  groundSpeedKt: number;
  mach: number;
  assignedSpeed: { unit: 'IAS' | 'MACH'; value: number } | null;
  verticalMode: 'LEVEL' | 'CLIMB' | 'DESCEND';
  navigationMode: 'ROUTE' | 'HEADING';
  flightPlan: FlightPlan;
  routeIntent: string[];
  nextWaypoint: number;
  owner: string | null;
  sectorId: string;
  nextSector: string | null;
  controlState: AircraftControlState;
  identification: RadarIdentificationState;
  communication: CommunicationState;
  handoff: Handoff | null;
  emergency: EmergencyState;
  history: ClearanceHistory[];
  trail: Point[];
  enteredTick: number;
  distanceNm: number;
  baselineNm: number;
  boundaryViolation: boolean;
  lastCommunicationTick: number;
}
export interface SeparationRule {
  id: string;
  horizontalNm: number;
  rvsmFt: number;
  nonRvsmFt: number;
  provenanceIds: string[];
}
export interface ConflictPrediction {
  aircraftIds: [string, string];
  timeToConflictSec: number;
  closestTimeSec: number;
  closestDistanceNm: number;
  point: Point;
}
export interface Conflict extends ConflictPrediction {
  id: string;
  actual: boolean;
  verticalFt: number;
  horizontalNm: number;
}
export interface SafetyNetAlert {
  id: string;
  aircraftIds: [string, string];
  startedTick: number;
  timeToConflictSec: number;
  actual: boolean;
}
export interface TrafficFlow {
  id: string;
  name: string;
  origins: string[];
  destinations: string[];
  routes: string[][];
  weight: number;
}
export interface WeatherCell extends Point {
  id: string;
  radiusNm: number;
  intensity: number;
  drift: Point;
}
export interface ScenarioEvent {
  atSec: number;
  kind: 'COMMS' | 'MEDICAL' | 'WEATHER' | 'PERFORMANCE' | 'FUEL';
  aircraftIndex: number;
}
export interface Scenario {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  durationSec: number;
  initialTraffic: number;
  spawnIntervalSec: number;
  seed: number;
  startUtcHour: number;
  weather: boolean;
  events: ScenarioEvent[];
  tutorial: boolean;
  conflict: boolean;
  fra: boolean;
  difficulty: number;
}
export interface SimulationClock {
  tick: number;
  stepSec: number;
  paused: boolean;
  speed: 0.5 | 1 | 2 | 4;
  startUtcMs: number;
}
export interface SimulationEvent {
  id: number;
  tick: number;
  type: string;
  aircraftId?: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}
export interface AIRACDataset {
  id: string;
  version: string;
  contentHash: string;
  effectiveDate: string;
  synthetic: boolean;
  firs: FIR[];
  sectors: Sector[];
  waypoints: Waypoint[];
  rules: RuleProvenance[];
  fra: {
    effectiveDate: string;
    startHour: number;
    endHour: number;
    lowerFt: number;
    upperFt: number;
    fidelity: Fidelity;
  };
}
export interface Metrics {
  handled: number;
  losses: number;
  lossSeconds: number;
  stcaEpisodes: number;
  resolvedConflicts: number;
  clearances: number;
  rejected: number;
  goodHandoffs: number;
  missedHandoffs: number;
  peakWorkload: number;
  extraMiles: number;
  delaySeconds: number;
}
export type RecordedAction = { tick: number; sequence: number } & (
  | { type: 'COMMAND'; intent: CommandIntent; source: 'UI' | 'TEXT' | 'REPLAY' }
  | { type: 'SECTOR'; sector: string; combine: boolean }
  | { type: 'FINISH' }
);
export interface SimulationState {
  readbacks: PilotReadback[];
  actions: RecordedAction[];
  engineVersion: string;
  datasetVersion: string;
  scenario: Scenario;
  seed: number;
  rng: number;
  clock: SimulationClock;
  aircraft: Aircraft[];
  weather: WeatherCell[];
  conflicts: Conflict[];
  alerts: SafetyNetAlert[];
  events: SimulationEvent[];
  nextEventId: number;
  commands: Clearance[];
  commandSequence: number;
  metrics: Metrics;
  selectedSector: string;
  combinedSectors: string[];
  complete: boolean;
  tutorialStep: number;
  spawned: number;
  activeLosses: string[];
  activeAlerts: string[];
  activePredictions: string[];
  fraActive: boolean;
}
export interface Replay {
  format: 1;
  engineVersion: string;
  datasetVersion: string;
  datasetHash: string;
  scenario: Scenario;
  seed: number;
  initialState: SimulationState;
  actions: RecordedAction[];
  commands: Clearance[];
  finalTick: number;
  finalHash: string;
  checkpoints: { tick: number; state: SimulationState }[];
  createdAt: string;
  eventHash: string;
}
export interface AirspaceDataProvider {
  load(): AIRACDataset;
}
export interface NavigationDataProvider {
  waypoints(): Waypoint[];
}
export interface ProcedureDataProvider {
  rules(): RuleProvenance[];
  separation(): SeparationRule;
}
export interface AircraftPerformanceProvider {
  types(): AircraftType[];
  profiles(): AircraftPerformanceProfile[];
}
export interface CommandIntent {
  callsign: string;
  kind: ClearanceKind;
  value?: string | number;
}
export type CommandResult = { ok: true; command: Clearance } | { ok: false; error: string };
export type WorkerRequest =
  | { type: 'START'; scenarioId: string; seed: number; density: number; duration: number }
  | { type: 'COMMAND'; intent: CommandIntent; source: 'UI' | 'TEXT' }
  | { type: 'PAUSE' }
  | { type: 'SPEED'; speed: 0.5 | 1 | 2 | 4 }
  | { type: 'SECTOR'; sector: string; combine?: boolean }
  | { type: 'FINISH' }
  | { type: 'REPLAY'; replay: Replay }
  | { type: 'SEEK'; tick: number }
  | { type: 'EXPORT_REPLAY' };
export type WorkerResponse =
  | { type: 'STATE'; state: SimulationState; replaying: boolean }
  | { type: 'RESULT'; result: CommandResult }
  | { type: 'ERROR'; message: string }
  | { type: 'REPLAY_DATA'; replay: Replay };
