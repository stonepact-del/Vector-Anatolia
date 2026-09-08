import type { Aircraft, CommandIntent, AIRACDataset } from '../domain/types';
import { performance } from '../data';
export function CommandStrip({
  data,
  a,
  commandTab,
  setCommandTab,
  issue,
  unavailable,
  onWhy,
  onDeselect,
}: {
  data: AIRACDataset;
  a: Aircraft;
  commandTab: string;
  setCommandTab: (tab: string) => void;
  issue: (kind: CommandIntent['kind'], value?: number | string) => void;
  unavailable: (kind: CommandIntent['kind'], value?: number | string) => string | null;
  onWhy: () => void;
  onDeselect: () => void;
}) {
  const dataset = data;
  return (
    <section className="command-strip" aria-label="Aircraft clearances">
      <div className="command-aircraft">
        <span className="eyebrow">CONTROLLING</span>
        <strong>{a.callsign}</strong>
      </div>
      <div className="command-buttons">
        {a.controlState === 'INBOUND' && (
          <button className="primary" onClick={() => issue('ACCEPT')}>
            ACCEPT
          </button>
        )}
        {a.owner && a.identification !== 'IDENTIFIED' && (
          <button onClick={() => issue('IDENTIFY')}>IDENTIFY</button>
        )}
        {['LEVEL', 'DIRECT', 'HEADING', 'SPEED', 'TRANSFER'].map((tab) => (
          <button
            key={tab}
            className={commandTab === tab ? 'active' : ''}
            onClick={() => setCommandTab(commandTab === tab ? '' : tab)}
          >
            {tab}
            <span>⌃</span>
          </button>
        ))}
        {a.navigationMode === 'HEADING' && (
          <button
            title={unavailable('RESUME') ?? ''}
            disabled={!!unavailable('RESUME')}
            onClick={() => issue('RESUME')}
          >
            RESUME NAV
          </button>
        )}
        {a.controlState === 'TRANSFER_INITIATED' && (
          <button className="primary" onClick={() => issue('CONTACT')}>
            CONTACT
          </button>
        )}
        {a.emergency.kind !== 'NONE' && !a.emergency.acknowledged && (
          <button onClick={() => issue('ACKNOWLEDGE')}>ACKNOWLEDGE</button>
        )}
      </div>
      <button className="text-button" onClick={onWhy}>
        WHY?
      </button>
      <button className="icon-button" aria-label="Deselect aircraft" onClick={onDeselect}>
        ×
      </button>
      {commandTab && (
        <div className="command-popover">
          <span className="eyebrow">
            {commandTab === 'SPEED'
              ? 'INDICATED AIRSPEED / MACH'
              : commandTab === 'LEVEL'
                ? `CLEARED FL${a.clearedAltitudeFt / 100} · SELECT NEW LEVEL`
                : commandTab === 'TRANSFER'
                  ? 'COORDINATE WITH ADJACENT SECTOR'
                  : commandTab === 'DIRECT'
                    ? 'SYNTHETIC DATASET FIXES'
                    : commandTab}
          </span>
          <div className="choice-grid">
            {commandTab === 'LEVEL' &&
              [
                23000, 25000, 27000, 28000, 29000, 30000, 31000, 32000, 33000, 34000, 35000, 36000,
                37000, 38000, 39000, 40000, 41000, 43000,
              ]
                .filter((v) => v <= performance(a.typeId, data).ceilingFt)
                .map((v) => (
                  <button
                    key={v}
                    disabled={!!unavailable('LEVEL', v)}
                    title={unavailable('LEVEL', v) ?? ''}
                    onClick={() =>
                      issue(v > a.altitudeFt ? 'CLIMB' : v < a.altitudeFt ? 'DESCEND' : 'LEVEL', v)
                    }
                  >
                    FL{v / 100}
                  </button>
                ))}
            {commandTab === 'DIRECT' &&
              dataset.waypoints.map((w) => (
                <button
                  key={w.id}
                  disabled={!!unavailable('DIRECT', w.id)}
                  title={unavailable('DIRECT', w.id) ?? ''}
                  onClick={() => issue('DIRECT', w.id)}
                >
                  {w.id}
                </button>
              ))}
            {commandTab === 'HEADING' &&
              Array.from({ length: 12 }, (_, i) => i * 30).map((v) => (
                <button
                  key={v}
                  disabled={!!unavailable('HEADING', v)}
                  title={unavailable('HEADING', v) ?? ''}
                  onClick={() => issue('HEADING', v)}
                >
                  {v.toString().padStart(3, '0')}°
                </button>
              ))}
            {commandTab === 'SPEED' && (
              <>
                {[220, 240, 260, 280, 300, 320].map((v) => (
                  <button
                    key={v}
                    disabled={!!unavailable('SPEED', v)}
                    title={unavailable('SPEED', v) ?? ''}
                    onClick={() => issue('SPEED', v)}
                  >
                    {v} KT
                  </button>
                ))}
                {[0.72, 0.76, 0.78, 0.8, 0.82, 0.84].map((v) => (
                  <button
                    key={v}
                    disabled={!!unavailable('MACH', v)}
                    title={unavailable('MACH', v) ?? ''}
                    onClick={() => issue('MACH', v)}
                  >
                    M{v.toFixed(2)}
                  </button>
                ))}
              </>
            )}
            {commandTab === 'TRANSFER' &&
              dataset.sectors
                .filter((s) =>
                  dataset.sectors.find((s) => s.id === a.sectorId)?.adjacent.includes(s.id),
                )
                .map((sec) => (
                  <button
                    key={sec.id}
                    disabled={!!unavailable('TRANSFER', sec.id)}
                    title={unavailable('TRANSFER', sec.id) ?? ''}
                    onClick={() => issue('TRANSFER', sec.id)}
                  >
                    {sec.id} / {sec.name}
                  </button>
                ))}
          </div>
          {unavailable(
            commandTab === 'LEVEL' ? 'LEVEL' : commandTab === 'DIRECT' ? 'DIRECT' : 'HEADING',
            commandTab === 'LEVEL' ? 35000 : commandTab === 'DIRECT' ? 'SIMCA' : 90,
          ) && <p className="validation-hint">{unavailable('HEADING', 90)}</p>}
        </div>
      )}
    </section>
  );
}
