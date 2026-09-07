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
        ].map(([label, value]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="report-timeline">
        {state.events
          .filter((e) => ['LOSS', 'STCA', 'ABNORMAL', 'HANDOFF', 'FRA'].includes(e.type))
          .slice(-20)
          .map((e) => (
            <p key={e.id}>
              <time>{time(e.tick * 0.25)}</time>
              {e.message}
            </p>
          ))}
        {!state.events.some((e) =>
          ['LOSS', 'STCA', 'ABNORMAL', 'HANDOFF', 'FRA'].includes(e.type),
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
