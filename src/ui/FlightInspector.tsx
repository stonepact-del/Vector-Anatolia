import type { Aircraft, SimulationState } from '../domain/types';
import { aircraftTypes } from '../data';
import { workload } from '../simulation/engine';
const time = (seconds: number) => new Date(seconds * 1000).toISOString().slice(14, 19);
export function FlightInspector({
  state,
  selected,
  onSelect,
  a,
}: {
  state: SimulationState;
  selected: string | null;
  onSelect: (id: string) => void;
  a?: Aircraft;
}) {
  const relevant = state.aircraft.filter(
    (ac) =>
      state.combinedSectors.includes(ac.sectorId) || state.combinedSectors.includes(ac.owner ?? ''),
  );
  return (
    <aside className="inspector">
      <div className="inspector-heading">
        <span>FLIGHT LIST</span>
        <span>{relevant.length} IN AREA</span>
      </div>
      <div className="workload">
        <div>
          <span>SIMULATOR WORKLOAD</span>
          <strong>
            {workload(state)}
            <small> / 100</small>
          </strong>
        </div>
        <div className="meter">
          <i style={{ width: `${workload(state)}%` }} />
        </div>
      </div>
      <div className="flight-list" aria-label="Aircraft">
        {[...relevant, ...state.aircraft.filter((ac) => !relevant.includes(ac))].map((ac) => (
          <button
            className={`flight-row ${selected === ac.id ? 'selected' : ''}`}
            onClick={() => {
              onSelect(ac.id);
            }}
            key={ac.id}
          >
            <span
              className={`flight-state ${ac.emergency.kind !== 'NONE' ? 'abnormal' : ac.controlState === 'INBOUND' ? 'inbound' : ''}`}
            >
              {ac.emergency.kind !== 'NONE' ? '△' : ac.controlState === 'INBOUND' ? '↘' : '◇'}
            </span>
            <span>
              <b>{ac.callsign}</b>
              <small>
                {ac.typeId} · {ac.flightPlan.origin} → {ac.flightPlan.destination}
              </small>
            </span>
            <span className="flight-level">
              {Math.round(ac.altitudeFt / 100)}
              <small>
                {ac.verticalMode === 'CLIMB'
                  ? '↑'
                  : ac.verticalMode === 'DESCEND'
                    ? '↓'
                    : ac.controlState === 'INBOUND'
                      ? 'INBOUND'
                      : ac.sectorId}
              </small>
            </span>
          </button>
        ))}
      </div>
      {a && (
        <div className="flight-detail">
          <div className="eyebrow">SELECTED FLIGHT / {a.typeId}</div>
          <h2>
            {a.callsign}
            <span>{a.flightPlan.rvsm ? 'RVSM' : 'NON-RVSM'}</span>
          </h2>
          <p>{aircraftTypes.find((t) => t.id === a.typeId)?.name}</p>
          <dl>
            <dt>Control</dt>
            <dd>{a.controlState.replaceAll('_', ' ')}</dd>
            <dt>Owner / next</dt>
            <dd>
              {a.owner ?? 'UNOWNED'} / {a.nextSector ?? '—'}
            </dd>
            <dt>Identification</dt>
            <dd>{a.identification}</dd>
            <dt>Communication</dt>
            <dd>{a.communication}</dd>
            <dt>Actual / cleared</dt>
            <dd>
              FL{Math.round(a.altitudeFt / 100)} / FL{a.clearedAltitudeFt / 100}
            </dd>
            <dt>Requested</dt>
            <dd>FL{a.requestedAltitudeFt / 100}</dd>
            <dt>IAS / GS / Mach</dt>
            <dd>
              {Math.round(a.iasKt)} / {Math.round(a.groundSpeedKt)} / {a.mach.toFixed(2)}
            </dd>
            <dt>Heading / track</dt>
            <dd>
              {Math.round(a.headingDeg)}° / {Math.round(a.trackDeg)}°
            </dd>
          </dl>
          <div className="route-text">{a.routeIntent.slice(a.nextWaypoint).join(' → ')}</div>
          {a.emergency.kind !== 'NONE' && (
            <div className="abnormal-box">
              △ {a.emergency.kind.replaceAll('_', ' ')}
              <br />
              <small>
                {a.emergency.resolved
                  ? 'Deviation / diversion clearance received'
                  : a.emergency.acknowledged
                    ? 'Acknowledged · protect surrounding traffic'
                    : 'Awaiting controller acknowledgment'}
              </small>
            </div>
          )}
          <div className="eyebrow history-title">CLEARANCE HISTORY</div>
          {a.history.length ? (
            a.history
              .slice(-3)
              .reverse()
              .map((h) => (
                <div className="history-row" key={h.command.id}>
                  <span>
                    {h.command.kind} {h.command.value}
                  </span>
                  <small>{h.status}</small>
                </div>
              ))
          ) : (
            <p className="empty">No clearances issued.</p>
          )}
        </div>
      )}
      <div className="communications">
        <span className="eyebrow">LATEST TRANSMISSIONS</span>
        {state.events
          .filter((e) => ['READBACK', 'ABNORMAL', 'WEATHER', 'INBOUND'].includes(e.type))
          .slice(-3)
          .reverse()
          .map((e) => (
            <p key={e.id}>
              <time>{time(e.tick * 0.25)}</time>
              {e.message}
            </p>
          ))}
      </div>
    </aside>
  );
}
