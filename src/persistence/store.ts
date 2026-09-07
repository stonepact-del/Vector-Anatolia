import { openDB } from 'idb';
import type { Replay } from '../domain/types';
export interface Settings {
  accepted: boolean;
  completed: string[];
  reducedMotion: boolean;
  labels: boolean;
  bests: Record<string, number>;
}
export const defaults: Settings = {
  accepted: false,
  completed: [],
  reducedMotion: false,
  labels: true,
  bests: {},
};
const db = () =>
  openDB('ankara-control', 1, {
    upgrade(db) {
      db.createObjectStore('local');
    },
  });
export async function getSettings(): Promise<Settings> {
  const value = await (await db()).get('local', 'settings');
  if (value === undefined) return structuredClone(defaults);
  if (!value || !Array.isArray(value.completed) || typeof value.accepted !== 'boolean')
    throw Error('Saved settings are corrupt. Reset local data in Settings.');
  return { ...defaults, ...value };
}
export async function putSettings(settings: Settings) {
  await (await db()).put('local', settings, 'settings');
}
export async function getReplays(): Promise<Replay[]> {
  return (await (await db()).get('local', 'replays')) ?? [];
}
export async function saveReplay(replay: Replay) {
  const replays = await getReplays();
  replays.unshift(replay);
  await (await db()).put('local', replays.slice(0, 20), 'replays');
}
export function validateImport(
  value: unknown,
): asserts value is { format: 1; settings: Settings; replays: Replay[] } {
  if (!value || typeof value !== 'object')
    throw Error('Import must be an Ankara Control JSON export.');
  const v = value as { format: number; settings: Settings; replays: Replay[] };
  if (
    v.format !== 1 ||
    !v.settings ||
    typeof v.settings.accepted !== 'boolean' ||
    !Array.isArray(v.settings.completed) ||
    !v.settings.completed.every((x) => typeof x === 'string') ||
    !Array.isArray(v.replays) ||
    v.replays.length > 20
  )
    throw Error('Invalid export format.');
  for (const r of v.replays) {
    if (
      r.format !== 1 ||
      typeof r.engineVersion !== 'string' ||
      !Number.isInteger(r.finalTick) ||
      r.finalTick < 0 ||
      r.finalTick > 14400 ||
      !r.initialState?.aircraft ||
      !Array.isArray(r.actions) ||
      !Array.isArray(r.commands) ||
      r.commands.length > 100000
    )
      throw Error('Invalid replay data.');
    if (
      !r.initialState.aircraft.every((a) =>
        [a.position.x, a.position.y, a.altitudeFt, a.tasKt].every(Number.isFinite),
      )
    )
      throw Error('Replay contains invalid aircraft values.');
  }
}
export async function exportLocal() {
  return { format: 1, settings: await getSettings(), replays: await getReplays() };
}
export async function importLocal(value: unknown) {
  validateImport(value);
  const d = await db(),
    tx = d.transaction('local', 'readwrite');
  await tx.store.put(value.settings, 'settings');
  await tx.store.put(value.replays, 'replays');
  await tx.done;
}
export async function resetLocal() {
  await (await db()).clear('local');
}
export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
