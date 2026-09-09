import { useState } from 'react';
import type { Settings } from '../persistence/store';
import { scenarios } from '../data';
import { disclaimer } from './strings';
import { dataset } from '../data';
import { challengeCode } from '../simulation/engine';
export function ScenarioBriefing({
  scenarioChoice,
  setScenarioChoice,
  settings,
  density,
  setDensity,
  duration,
  setDuration,
  seed,
  setSeed,
  start,
  setModal,
}: {
  scenarioChoice: string;
  setScenarioChoice: (v: string) => void;
  settings: Settings;
  density: number;
  setDensity: (v: number) => void;
  duration: number;
  setDuration: (v: number) => void;
  seed: number;
  setSeed: (v: number) => void;
  start: () => void;
  setModal: (v: 'about' | 'replays') => void;
}) {
  const [practice, setPractice] = useState(false);
  const scenario = scenarios.find((s) => s.id === scenarioChoice)!;
  return (
    <>
      <div className="briefing-heading">
        <div>
          <h1>
            Your airspace.
            <br />
            <span>Your decisions.</span>
          </h1>
          <p>Türkiye Area Control Simulator</p>
        </div>
        <div className="briefing-index">
          01—10
          <br />
          <small>OPERATIONAL SCENARIOS</small>
        </div>
      </div>
      <div className="scenario-layout">
        <div className="scenario-list">
          <label className="practice-toggle">
            <input
              type="checkbox"
              checked={practice}
              onChange={(e) => setPractice(e.target.checked)}
            />{' '}
            PRACTICE ALL SCENARIOS
          </label>
          {scenarios.map((sc, i) => (
            <button
              key={sc.id}
              disabled={
                !practice &&
                i > 0 &&
                !settings.completed.includes(scenarios[i - 1].id) &&
                !settings.completed.includes(sc.id)
              }
              className={scenarioChoice === sc.id ? 'selected' : ''}
              onClick={() => setScenarioChoice(sc.id)}
            >
              <span className="scenario-number">{String(i + 1).padStart(2, '0')}</span>
              <span>
                <b>{sc.name}</b>
                <small>
                  {sc.tutorial
                    ? 'GUIDED SESSION'
                    : sc.difficulty === 3
                      ? 'ADVANCED'
                      : sc.difficulty === 2
                        ? 'CHALLENGING'
                        : 'STANDARD'}
                  {settings.completed.includes(sc.id) ? ' · COMPLETED' : ''}
                </small>
              </span>
              <span className="scenario-arrow">↗</span>
            </button>
          ))}
        </div>
        <div className="scenario-brief">
          <span className="eyebrow">{scenario.subtitle}</span>
          <h2>{scenario.name}</h2>
          <p>{scenario.description}</p>
          <div className="brief-graphic">
            <svg viewBox="0 0 300 120" aria-hidden="true">
              <path d="M0 80L65 60L135 70L220 20L300 40M10 20L90 50L170 110L300 80M0 100L120 20L230 85L300 90" />
              <circle cx="135" cy="70" r="6" />
              <circle cx="90" cy="50" r="4" />
              <circle cx="230" cy="85" r="4" />
              <path className="graphic-highlight" d="M65 60L135 70L220 20" />
            </svg>
            <span>SYNTHETIC ANATOLIA NETWORK</span>
          </div>
          <div className="brief-options">
            <label>
              TRAFFIC DENSITY
              <select value={density} onChange={(e) => setDensity(Number(e.target.value))}>
                <option value={0.65}>LOW / LEARNING</option>
                <option value={1}>STANDARD</option>
                <option value={1.6}>BUSY</option>
              </select>
            </label>
            <label>
              SHIFT LENGTH
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                <option value={900}>15 MINUTES</option>
                <option value={1800}>30 MINUTES</option>
                <option value={3600}>60 MINUTES</option>
              </select>
            </label>
            <label>
              SCENARIO SEED
              <input
                aria-label="Scenario seed"
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
              />
            </label>
          </div>
          <p className="practice-note">
            DEMAND PROFILE · QUIET → BUILDING → BUSY → PEAK → RECOVERY
            <br />
            CHALLENGE {challengeCode(scenario.id, seed, dataset.version)} · All scenarios are
            available in practice mode.
          </p>
          <button className="primary begin" onClick={start}>
            {scenario.tutorial ? 'BEGIN GUIDED SESSION' : 'BEGIN SHIFT'} <span>↗</span>
          </button>
        </div>
      </div>
      <div className="briefing-footer">
        <p>{disclaimer}</p>
        <button className="text-button" onClick={() => setModal('about')}>
          ABOUT & SOURCES ↗
        </button>
        <button className="text-button" onClick={() => setModal('replays')}>
          REPLAYS ↗
        </button>
      </div>
    </>
  );
}
