import { ScenarioBriefing } from './ui/ScenarioBriefing';
import { Fidelity } from './ui/Fidelity';
import { disclaimer } from './ui/strings';
import { FlightInspector } from './ui/FlightInspector';
import { CommandStrip } from './ui/CommandStrip';
import { ShiftReport } from './ui/ShiftReport';
import { useEffect, useRef, useState } from 'react';
import type {
  CommandIntent,
  Replay,
  SimulationState,
  WorkerRequest,
  WorkerResponse,
} from './domain/types';
import { dataset as defaultDataset } from './data';
import { Radar } from './rendering/Radar';
import { parseCommand, validateCommand, verbs } from './simulation/commands';
import { tutorialSteps } from './simulation/engine';
import {
  defaults,
  download,
  exportLocal,
  getReplays,
  getSettings,
  importLocal,
  putSettings,
  resetLocal,
  saveReplay,
  type Settings,
} from './persistence/store';
const time = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`;

export default function App() {
  const [state, setState] = useState<SimulationState | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [settings, setSettings] = useState<Settings>(defaults),
    [modal, setModal] = useState<'scenarios' | 'settings' | 'replays' | 'about' | null>(
      'scenarios',
    ),
    [network, setNetwork] = useState(false),
    [inspector, setInspector] = useState(true),
    [commandTab, setCommandTab] = useState(''),
    [command, setCommand] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [replays, setReplays] = useState<Replay[]>([]),
    [replaying, setReplaying] = useState(false),
    [replayLimit, setReplayLimit] = useState(0),
    [density, setDensity] = useState(1),
    [duration, setDuration] = useState(900),
    [seed, setSeed] = useState(2609),
    [scenarioChoice, setScenarioChoice] = useState('tutorial'),
    [showWhy, setShowWhy] = useState(false);
  const worker = useRef<Worker | null>(null),
    stateRef = useRef(state),
    commandInput = useRef<HTMLInputElement>(null),
    pendingCommand = useRef<string | null>(null),
    saved = useRef(false),
    exportRequested = useRef(false);
  const dataset = state?.dataset ?? defaultDataset;
  stateRef.current = state;
  const send = (m: WorkerRequest) => worker.current?.postMessage(m);
  const updateSettings = (next: Settings) => {
    setSettings(next);
    putSettings(next).catch((e) => setError(`Settings could not be saved: ${e.message}`));
  };
  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch((e) => setError(e.message));
    getReplays()
      .then(setReplays)
      .catch((e) => setError(`Replay storage unavailable: ${e.message}`));
    const w = new Worker(new URL('./workers/simulation.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.current = w;
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const m = e.data;
      if (m.type === 'STATE') {
        setState(m.state);
        setReplaying(m.replaying);
        setReplayLimit(m.replayFinalTick ?? 0);
        if (pendingCommand.current) {
          const history = m.state.aircraft
            .flatMap((a) => a.history)
            .find((h) => h.command.id === pendingCommand.current);
          if (history && history.status !== 'QUEUED') {
            setMessage(history.message);
            pendingCommand.current = null;
          }
        }
      }
      if (m.type === 'ERROR') setError(m.message);
      if (m.type === 'RESULT') {
        if (m.result.ok) pendingCommand.current = m.result.command.id;
        setMessage(m.result.ok ? 'Clearance queued · awaiting response' : m.result.error);
      }
      if (m.type === 'REPLAY_DATA') {
        saveReplay(m.replay)
          .then(() => getReplays().then(setReplays))
          .catch((e) => setError(`Replay could not be saved: ${e.message}`));
        if (exportRequested.current) {
          download(`ankara-${m.replay.seed}.json`, m.replay);
          exportRequested.current = false;
        }
      }
    };
    w.onerror = (e) => setError(`Simulation worker failed: ${e.message}. Reload to recover.`);
    const visibility = () => {
      if (document.hidden && stateRef.current && !stateRef.current.clock.paused)
        w.postMessage({ type: 'PAUSE' });
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      w.terminate();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  useEffect(() => {
    if (state?.complete && !saved.current && !replaying) {
      saved.current = true;
      send({ type: 'EXPORT_REPLAY' });
      const earned =
        state.metrics.losses === 0 &&
        (state.scenario.tutorial
          ? state.tutorialStep === 5
          : state.clock.tick * 0.25 >= state.scenario.durationSec);
      const next = {
        ...settings,
        completed: earned
          ? [...new Set([...settings.completed, state.scenario.id])]
          : settings.completed,
        bests: {
          ...settings.bests,
          [state.scenario.id]: Math.max(
            settings.bests[state.scenario.id] ?? 0,
            state.metrics.losses === 0 ? state.metrics.handled : 0,
          ),
        },
      };
      updateSettings(next);
    }
  }, [state?.complete]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (modal) return;
      if ((e.target as HTMLElement).matches('input,select,textarea')) return;
      if (e.key === ' ' && state && !(e.target as HTMLElement).closest('button,a')) {
        e.preventDefault();
        send({ type: 'PAUSE' });
      }
      if (e.key === '/') {
        e.preventDefault();
        commandInput.current?.focus();
      }
      if (e.key === 'Escape') {
        setCommandTab('');
        setSelected(null);
      }
      if (e.key === 'Tab' && e.altKey && state) {
        e.preventDefault();
        const index = state.aircraft.findIndex((a) => a.id === selected);
        setSelected(state.aircraft[(index + 1) % state.aircraft.length]?.id ?? null);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [state, selected, modal]);
  useEffect(() => {
    if (!modal) return;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,a[href]') ?? [],
      ).filter((el) => el.offsetParent !== null);
    focusable()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const nodes = focusable();
      if (!nodes.length) return;
      if (event.shiftKey && document.activeElement === nodes[0]) {
        event.preventDefault();
        nodes.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === nodes.at(-1)) {
        event.preventDefault();
        nodes[0].focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, [modal]);
  const a = state?.aircraft.find((a) => a.id === selected),
    sector = dataset.sectors.find((s) => s.id === state?.selectedSector);
  const issue = (kind: CommandIntent['kind'], value?: number | string) => {
    if (a) {
      send({ type: 'COMMAND', intent: { callsign: a.callsign, kind, value }, source: 'UI' });
      setCommandTab('');
    }
  };
  const unavailable = (kind: CommandIntent['kind'], value?: number | string) =>
    a && state
      ? validateCommand({ callsign: a.callsign, kind, value }, a, state, dataset)
      : 'Select an aircraft';
  const start = () => {
    if (!Number.isInteger(seed)) {
      setError('Seed must be a whole number.');
      return;
    }
    saved.current = false;
    setSelected(null);
    setNetwork(false);
    setCommandTab('');
    setMessage('');
    setModal(null);
    send({ type: 'START', scenarioId: scenarioChoice, seed, density, duration });
    if (!settings.accepted) updateSettings({ ...settings, accepted: true });
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseCommand(command);
    if (!parsed.ok) {
      setMessage(parsed.error);
      return;
    }
    send({ type: 'COMMAND', intent: parsed.intent, source: 'TEXT' });
    setCommand('');
  };
  const openModal = (value: typeof modal) => {
    if (state && !state.clock.paused && !state.complete) send({ type: 'PAUSE' });
    setModal(value);
  };
  return (
    <div className={`app ${settings.reducedMotion ? 'reduced-motion' : ''}`}>
      <header className="topbar">
        <button className="brand" onClick={() => openModal('scenarios')}>
          <img src="./mark.svg" alt="" />
          <span>
            ANKARA <b>CONTROL</b>
            <small>TÜRKİYE AREA CONTROL SIMULATOR</small>
          </span>
        </button>
        <div className="top-divider" />
        <div className="sector-title">
          <span className="eyebrow">CONTROLLER POSITION</span>
          <strong>
            {sector?.name ?? 'ANKARA ACC'}{' '}
            <span>{state ? `/ ${state.selectedSector}` : ' / SIMULATION'}</span>
          </strong>
        </div>
        <div className="top-spacer" />
        {state && (
          <>
            <div className="clock">
              <span className="eyebrow">SIM UTC</span>
              <strong>
                {new Date(state.clock.startUtcMs + state.clock.tick * 250)
                  .toISOString()
                  .slice(11, 19)}
              </strong>
            </div>
            <div className="traffic-total">
              <strong>{state.aircraft.length.toString().padStart(2, '0')}</strong>
              <span>TRAFFIC</span>
            </div>
            <div className="speed-controls" aria-label="Simulation speed">
              {([0.5, 1, 2, 4] as const).map((speed) => (
                <button
                  className={state.clock.speed === speed ? 'active' : ''}
                  onClick={() => send({ type: 'SPEED', speed })}
                  key={speed}
                >
                  {speed}×
                </button>
              ))}
            </div>
            <button
              className={`pause ${state.clock.paused ? 'active' : ''}`}
              onClick={() => send({ type: 'PAUSE' })}
              disabled={state.complete}
              aria-label={state.clock.paused ? 'Resume simulation' : 'Pause simulation'}
            >
              {state.clock.paused ? '▶' : 'Ⅱ'}
              <span>{state.clock.paused ? 'RESUME' : 'PAUSE'}</span>
            </button>
          </>
        )}
        <button className="icon-button" aria-label="Settings" onClick={() => openModal('settings')}>
          ⚙
        </button>
      </header>
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setError('')} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      {state ? (
        <>
          <main className="workspace">
            <div className="scope">
              <div className="scope-toolbar">
                <div className="view-tabs">
                  <button className={!network ? 'active' : ''} onClick={() => setNetwork(false)}>
                    TACTICAL
                  </button>
                  <button className={network ? 'active' : ''} onClick={() => setNetwork(true)}>
                    NETWORK
                  </button>
                </div>
                <span className={`fra-status ${state.fraActive ? 'on' : ''}`}>
                  ◇ FRA {state.fraActive ? 'ACTIVE' : 'STANDBY'}{' '}
                  <small>MODELED / 27 NOV 2025</small>
                </span>
                <button
                  className="text-button inspector-toggle"
                  onClick={() => setInspector(!inspector)}
                >
                  {inspector ? 'HIDE' : 'SHOW'} FLIGHT LIST
                </button>
              </div>
              <Radar
                state={state}
                selected={selected}
                onSelect={(id) => {
                  setSelected(id);
                  setMessage('');
                  setCommandTab('');
                }}
                network={network}
                showLabels={settings.labels}
              />
              {state.clock.paused && !state.complete && (
                <div className="pause-tag">
                  Ⅱ {replaying ? 'REPLAY PAUSED' : 'SIMULATION PAUSED'}
                </div>
              )}
              <div className="alert-stack" aria-live="polite">
                {state.alerts
                  .filter(
                    (c) =>
                      network ||
                      c.aircraftIds.some((id) =>
                        state.aircraft.some(
                          (ac) =>
                            ac.id === id &&
                            (state.combinedSectors.includes(ac.owner ?? '') ||
                              state.combinedSectors.includes(ac.sectorId)),
                        ),
                      ),
                  )
                  .slice(0, 3)
                  .map((c) => (
                    <button
                      className="safety-alert"
                      key={c.id}
                      onClick={() => {
                        setSelected(c.aircraftIds[0]);
                        setShowWhy(true);
                      }}
                    >
                      <span className="alert-mark">!</span>
                      <span>
                        <b>{c.actual ? 'SEPARATION LOSS' : 'STCA'}</b>
                        <small>
                          {c.aircraftIds
                            .map((id) => state.aircraft.find((a) => a.id === id)?.callsign)
                            .join(' / ')}
                        </small>
                      </span>
                      <strong>{time(c.timeToConflictSec)}</strong>
                    </button>
                  ))}
                {state.alerts.length > 3 && (
                  <span className="alert-overflow">
                    + {state.alerts.length - 3} additional alerts · see conflicts
                  </span>
                )}
              </div>
              {state.scenario.tutorial && !network && (
                <div className="tutorial">
                  <span className="eyebrow">
                    GUIDED SESSION · {Math.min(state.tutorialStep + 1, 6)} / 6
                  </span>
                  <div className="tutorial-progress">
                    {tutorialSteps.map((_, i) => (
                      <i key={i} className={i <= state.tutorialStep ? 'done' : ''} />
                    ))}
                  </div>
                  <h3>{tutorialSteps[state.tutorialStep].title}</h3>
                  <p>{tutorialSteps[state.tutorialStep].text}</p>
                  <button className="text-button" onClick={() => setShowWhy(!showWhy)}>
                    WHY? ↗
                  </button>
                </div>
              )}
              {network && !replaying && (
                <div className="network-picker">
                  <span className="eyebrow">TAKE POSITION / COMBINE</span>
                  {dataset.sectors.map((sec) => (
                    <div key={sec.id}>
                      <button
                        className={state.combinedSectors.includes(sec.id) ? 'active' : ''}
                        onClick={() => send({ type: 'SECTOR', sector: sec.id })}
                      >
                        {sec.id} {sec.name}
                      </button>
                      <button
                        aria-label={`Combine ${sec.name}`}
                        onClick={() => send({ type: 'SECTOR', sector: sec.id, combine: true })}
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="scope-footer">
                <span>
                  <i className="status-dot" /> {state.scenario.name}
                </span>
                <span>
                  SHIFT {time(state.clock.tick * 0.25)} / {time(state.scenario.durationSec)}
                </span>
                {replaying ? (
                  <button className="text-button" onClick={() => openModal('replays')}>
                    REPLAY LIBRARY ↗
                  </button>
                ) : (
                  <button className="text-button" onClick={() => send({ type: 'FINISH' })}>
                    END SHIFT ↗
                  </button>
                )}
              </div>
            </div>
            {inspector && (
              <FlightInspector
                state={state}
                selected={selected}
                a={a}
                onSelect={(id) => {
                  setSelected(id);
                  setCommandTab('');
                  setMessage('');
                }}
              />
            )}
          </main>
          {showWhy && (
            <div className="why-panel">
              <button
                className="close"
                onClick={() => setShowWhy(false)}
                aria-label="Close explanation"
              >
                ×
              </button>
              <span className="eyebrow">UNDERSTAND THE SIMULATION</span>
              <h3>Plan ahead. Protect separation.</h3>
              <p>
                A conflict requires both horizontal and vertical separation to fall below the
                applicable modeled minima. Planning looks five minutes ahead; STCA is a separate
                120-second safety net. Neither guarantees that an issued clearance is safe.
              </p>
              <p>
                Accept → identify → control → coordinate → contact. Crossing a boundary does not
                transfer responsibility automatically.
              </p>
              {state.conflicts.map((c) => (
                <p key={c.id}>
                  {c.aircraftIds
                    .map((id) => state.aircraft.find((a) => a.id === id)?.callsign)
                    .join(' / ')}{' '}
                  · {c.horizontalNm.toFixed(1)} NM · {Math.round(c.verticalFt)} ft · predicted{' '}
                  {time(c.timeToConflictSec)}
                </p>
              ))}
              <button
                className="text-button"
                onClick={() => {
                  setShowWhy(false);
                  openModal('about');
                }}
              >
                SIMULATION FIDELITY ↗
              </button>
            </div>
          )}
          {a && !replaying && (
            <CommandStrip
              data={dataset}
              a={a}
              commandTab={commandTab}
              setCommandTab={setCommandTab}
              issue={issue}
              unavailable={unavailable}
              onWhy={() => setShowWhy(!showWhy)}
              onDeselect={() => setSelected(null)}
            />
          )}
          {!replaying ? (
            <div className="command-line">
              <span>›</span>
              <form onSubmit={submit}>
                <input
                  ref={commandInput}
                  aria-label="Command entry"
                  placeholder={
                    a ? `${a.callsign} CLIMB FL370` : 'Command entry / CALLSIGN CLIMB FL370'
                  }
                  value={command}
                  onChange={(e) => setCommand(e.target.value.toUpperCase())}
                  list="command-suggestions"
                  autoComplete="off"
                />
                <datalist id="command-suggestions">
                  {verbs.map((v) => (
                    <option
                      key={v}
                      value={`${a?.callsign ?? state.aircraft[0]?.callsign ?? ''} ${v}`}
                    />
                  ))}
                </datalist>
              </form>
              <span className="command-feedback" role="status">
                {message || 'ALT + TAB  SELECT NEXT  ·  /  COMMAND  ·  SPACE  PAUSE'}
              </span>
              <button className="text-button" onClick={() => openModal('about')}>
                SIMULATION FIDELITY
              </button>
            </div>
          ) : (
            <div className="replay-bar">
              <b>REPLAY</b>
              <input
                aria-label="Replay seek"
                type="range"
                min={0}
                max={replayLimit}
                value={state.clock.tick}
                onChange={(e) => send({ type: 'SEEK', tick: Number(e.target.value) })}
              />
              <span>{time(state.clock.tick * 0.25)}</span>
            </div>
          )}
          {state.complete && !replaying && (
            <div className="modal-backdrop">
              <ShiftReport
                state={state}
                onExport={() => {
                  exportRequested.current = true;
                  send({ type: 'EXPORT_REPLAY' });
                }}
                onReplayLibrary={() => {
                  setState(null);
                  setModal('replays');
                }}
                onNextShift={() => {
                  setState(null);
                  setModal('scenarios');
                }}
              />
            </div>
          )}
        </>
      ) : (
        <div className="landing-background">
          <div className="landing-grid" />
          <div className="landing-wordmark">
            ANKARA
            <br />
            CONTROL<span>39°56′N / 032°51′E</span>
          </div>
          <div className="landing-caption">
            PROCEDURAL THINKING.
            <br />
            CLEAR DECISIONS.
          </div>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop">
          <section
            className={`modal ${modal === 'scenarios' ? 'scenario-modal' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={modal}
          >
            <div className="modal-top">
              <span className="eyebrow">
                ANKARA CONTROL / {modal === 'scenarios' ? 'SHIFT BRIEFING' : modal.toUpperCase()}
              </span>
              {state && (
                <button className="close" aria-label="Close dialog" onClick={() => setModal(null)}>
                  ×
                </button>
              )}
            </div>
            {modal === 'scenarios' ? (
              <ScenarioBriefing
                scenarioChoice={scenarioChoice}
                setScenarioChoice={setScenarioChoice}
                settings={settings}
                density={density}
                setDensity={setDensity}
                duration={duration}
                setDuration={setDuration}
                seed={seed}
                setSeed={setSeed}
                start={start}
                setModal={setModal}
              />
            ) : modal === 'settings' ? (
              <>
                <h1>Display & local data</h1>
                <div className="setting-row">
                  <label htmlFor="labels">Aircraft labels</label>
                  <input
                    id="labels"
                    type="checkbox"
                    checked={settings.labels}
                    onChange={(e) => updateSettings({ ...settings, labels: e.target.checked })}
                  />
                </div>
                <div className="setting-row">
                  <label htmlFor="motion">Reduced motion</label>
                  <input
                    id="motion"
                    type="checkbox"
                    checked={settings.reducedMotion}
                    onChange={(e) =>
                      updateSettings({ ...settings, reducedMotion: e.target.checked })
                    }
                  />
                </div>
                <p>
                  Everything stays in this browser. Up to 20 replays are retained. Export a backup
                  before clearing browser storage.
                </p>
                <div className="settings-actions">
                  <button
                    onClick={() =>
                      exportLocal()
                        .then((v) => download('ankara-control-data.json', v))
                        .catch((e) => setError(e.message))
                    }
                  >
                    EXPORT DATA
                  </button>
                  <label className="button-label">
                    IMPORT DATA
                    <input
                      type="file"
                      accept="application/json"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          if (file.size > 134_217_728)
                            throw Error('Import is too large (128 MiB maximum).');
                          await importLocal(JSON.parse(await file.text()));
                          setSettings(await getSettings());
                          setReplays(await getReplays());
                          setMessage('Local data imported.');
                        } catch (e) {
                          setError(String(e));
                        }
                      }}
                    />
                  </label>
                  <button
                    onClick={() => {
                      if (window.confirm('Delete all local settings, progress and replays?'))
                        resetLocal()
                          .then(() => {
                            setSettings(defaults);
                            setReplays([]);
                          })
                          .catch((e) => setError(e.message));
                    }}
                  >
                    RESET DATA
                  </button>
                </div>
                <button className="text-button" onClick={() => setModal('about')}>
                  SIMULATION FIDELITY ↗
                </button>
                <p className="disclaimer">{disclaimer}</p>
                <button onClick={() => setModal(state ? null : 'scenarios')}>BACK</button>
              </>
            ) : modal === 'about' ? (
              <Fidelity state={state} onBack={() => setModal(state ? null : 'scenarios')} />
            ) : (
              <>
                <h1>Replay library</h1>
                <p>Revisit decisions at your own pace. Recordings stay in this browser.</p>
                {replays.length ? (
                  replays.map((r, i) => (
                    <button
                      className="replay-row"
                      key={`${r.createdAt}-${i}`}
                      onClick={() => {
                        send({ type: 'REPLAY', replay: r });
                        setModal(null);
                        setSelected(null);
                      }}
                    >
                      <span>
                        <b>{r.scenario.name}</b>
                        <small>
                          SEED {r.seed} · {time(r.finalTick * 0.25)} ·{' '}
                          {new Date(r.createdAt).toLocaleDateString()}
                        </small>
                      </span>
                      <span>PLAY ↗</span>
                    </button>
                  ))
                ) : (
                  <div className="empty-state">
                    No recordings yet.
                    <br />
                    <small>Complete a shift to save your first replay.</small>
                  </div>
                )}
                <button onClick={() => setModal(state ? null : 'scenarios')}>BACK</button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
