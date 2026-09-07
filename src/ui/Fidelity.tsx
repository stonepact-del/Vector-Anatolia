import { rules } from '../data';
import { disclaimer } from './strings';
export function Fidelity({ state, onBack }: { state: unknown; onBack: () => void }) {
  return (
    <>
      <h1>Simulation fidelity</h1>
      <p className="lead">Real concepts. Explicit modeling.</p>
      <p>{disclaimer}</p>
      <div className="fidelity-key">
        <p>
          <b>VERIFIED</b> — Applicable source and effective version confirmed.
        </p>
        <p>
          <b>MODELED</b> — Original simulation behavior or applicability not fully established.
        </p>
        <p>
          <b>SIMPLIFIED</b> — A documented reduction of procedural complexity.
        </p>
        <p>
          <b>UNKNOWN</b> — Insufficient evidence; never presented as verified.
        </p>
      </div>
      <p>
        No current operational rule is claimed VERIFIED in this release. The published source
        snapshots below inform the modeled implementation. All geometry, fixes, schedules and
        aircraft performance are synthetic.
      </p>
      <div className="source-list">
        {rules
          .filter((r) => r.authority !== 'ANKARA CONTROL')
          .map((r) => (
            <a href={r.sourceUrl} target="_blank" rel="noreferrer" key={r.ruleId}>
              <span>
                {r.ruleId}
                <small>
                  {r.authority} · {r.document} §{r.section}
                </small>
              </span>
              <b>{r.fidelity} ↗</b>
            </a>
          ))}
      </div>
      <p>
        FRA scenarios use the 27 November 2025 publication snapshot, not a live AIRAC service. No
        live aircraft data, external maps, accounts or runtime APIs are used.
      </p>
      <button onClick={onBack}>BACK TO {state ? 'RADAR' : 'BRIEFING'}</button>
    </>
  );
}
