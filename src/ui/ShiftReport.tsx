import type { SimulationState } from '../domain/types';
const time = (seconds: number) => new Date(seconds * 1000).toISOString().slice(14, 19);
export function ShiftReport({
  state,
  onExport,
  onReplayLibrary,
  onNextShift,
}: {
  state: SimulationState;
  onExport: () => void;
  onReplayLibrary: () => void;
  onNextShift: () => void;
}) {
  const safety = Math.max(0, 100 - state.metrics.losses * 45 - state.metrics.stcaEpisodes * 8);
  const flow = Math.max(
    0,
    Math.round(100 - state.metrics.missedHandoffs * 12 - state.metrics.delaySeconds / 60),
  );
  const efficiency = Math.max(
    0,
    Math.round(100 - state.metrics.extraMiles / 2 - state.metrics.unnecessaryInterventions * 3),
  );
  return (
    <section className="report modal">
      <span className="eyebrow">POST-SHIFT REVIEW / {state.scenario.name}</span>
      <h1>{state.metrics.losses ? 'Safety requires attention.' : 'Shift complete.'}</h1>
      <p className="lead">
        {state.metrics.losses
          ? 'Review the timeline and identify where intervention came too late.'
          : 'Review your decisions, coordination and traffic flow.'}
      </p>
      <div className={`safety-result ${state.metrics.losses ? 'failed' : ''}`}>
        <span>SAFETY ASSESSMENT</span>
        <strong>{state.metrics.losses ? 'NOT PASSED' : 'SEPARATION MAINTAINED'}</strong>
      </div>
      <div className="debrief-scores">
        <span>
          SAFETY <b>{safety}</b>
        </span>
        <span>
          FLOW <b>{flow}</b>
        </span>
        <span>
          EFFICIENCY <b>{efficiency}</b>
        </span>
      </div>
      <div className="report-metrics">
        {[
          ['Aircraft handled', state.metrics.handled],
          ['Separation losses', state.metrics.losses],
          ['STCA episodes', state.metrics.stcaEpisodes],
          ['Resolved predictions', state.metrics.resolvedConflicts],
          [
            'Good / missed handoffs',
            `${state.metrics.goodHandoffs} / ${state.metrics.missedHandoffs}`,
          ],
          ['Peak workload', `${state.metrics.peakWorkload} / 100`],
          ['Clearances', state.metrics.clearances],
          ['Extra track miles', state.metrics.extraMiles.toFixed(1)],
          ['Pilot requests', `${state.metrics.approvedRequests} / ${state.metrics.pilotRequests}`],
          ['Peak radio load', `${state.metrics.peakFrequencyLoad}%`],
          [
            'Mean handoff delay',
            state.metrics.goodHandoffs
              ? `${Math.round((state.metrics.handoffDelayTicks * 0.25) / state.metrics.goodHandoffs)}s`
              : '—',
          ],
          ['Interventions', state.metrics.unnecessaryInterventions],
        ].map(([label, value]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="report-timeline">
        {state.events
          .filter((e) =>
            [
              'LOSS',
              'STCA',
              'ABNORMAL',
              'HANDOFF',
              'FRA',
              'REQUEST',
              'REQUEST_APPROVED',
              'REQUEST_DENIED',
              'COORDINATION',
              'INITIAL_CALL',
            ].includes(e.type),
          )
          .slice(-20)
          .map((e) => (
            <p key={e.id}>
              <time>{time(e.tick * 0.25)}</time>
              {e.message}
            </p>
          ))}
        {!state.events.some((e) =>
          [
            'LOSS',
            'STCA',
            'ABNORMAL',
            'HANDOFF',
            'FRA',
            'REQUEST',
            'REQUEST_APPROVED',
            'REQUEST_DENIED',
            'COORDINATION',
            'INITIAL_CALL',
          ].includes(e.type),
        ) && <p>No major events recorded.</p>}
      </div>
      <div className="modal-actions">
        <button onClick={onExport}>EXPORT REPLAY</button>
        <button onClick={onReplayLibrary}>REPLAY LIBRARY</button>
        <button className="primary" onClick={onNextShift}>
          NEXT SHIFT ↗
        </button>
      </div>
    </section>
  );
}
