import { useEffect, useRef, useState } from 'react';
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { Aircraft, SimulationState } from '../domain/types';
import { dataset } from '../data';
import { vector } from '../simulation/math';
interface Props {
  state: SimulationState;
  selected: string | null;
  onSelect: (id: string) => void;
  network: boolean;
  showLabels: boolean;
}
export function Radar({ state, selected, onSelect, network, showLabels }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef({ state, selected, onSelect, network, showLabels });
  latest.current = { state, selected, onSelect, network, showLabels };
  const [error, setError] = useState('');
  const zoomAction = useRef<(n: number) => void>(() => {});
  useEffect(() => {
    let disposed = false;
    let app: Application | undefined;
    let observer: ResizeObserver | undefined;
    let cleanup: () => void = () => {};
    (async () => {
      try {
        app = new Application();
        await app.init({
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(devicePixelRatio, 2),
          autoDensity: true,
          preference: 'webgl',
        });
        if (disposed) {
          app.destroy(true);
          return;
        }
        const element = host.current!;
        element.appendChild(app.canvas);
        app.canvas.setAttribute(
          'aria-label',
          'Interactive radar. Use the traffic list to select aircraft with the keyboard.',
        );
        const world = new Container(),
          geometry = new Graphics(),
          dynamic = new Graphics(),
          texts = new Container();
        world.addChild(geometry, dynamic, texts);
        app.stage.addChild(world);
        const labels = new Map<string, Text>();
        let revision = 0;
        let lastDraw = '';
        let scale = 1,
          pan = { x: 0, y: 0 },
          drag: { x: number; y: number; px: number; py: number } | null = null;
        let previousNetwork = latest.current.network;
        const offsets = new Map<string, { x: number; y: number }>();
        let draggedLabel: string | null = null;
        const fit = () => {
          revision++;
          const w = element.clientWidth,
            h = element.clientHeight;
          app!.renderer.resize(w, h);
          scale = Math.min((w - 100) / 800, (h - 90) / 380);
          pan = { x: (w - 800 * scale) / 2, y: (h - 380 * scale) / 2 };
          world.position.set(pan.x, pan.y);
          world.scale.set(scale);
        };
        observer = new ResizeObserver(fit);
        observer.observe(element);
        fit();
        zoomAction.current = (n) => {
          revision++;
          if (n === 0) {
            fit();
            return;
          }
          const old = scale;
          scale = Math.max(0.45, Math.min(5, scale * n));
          const center = { x: element.clientWidth / 2, y: element.clientHeight / 2 };
          pan = {
            x: center.x - ((center.x - pan.x) * scale) / old,
            y: center.y - ((center.y - pan.y) * scale) / old,
          };
          world.scale.set(scale);
          world.position.set(pan.x, pan.y);
        };
        const wheel = (e: WheelEvent) => {
          revision++;
          e.preventDefault();
          const rect = element.getBoundingClientRect(),
            x = e.clientX - rect.left,
            y = e.clientY - rect.top,
            old = scale;
          scale = Math.max(0.45, Math.min(5, scale * (e.deltaY < 0 ? 1.12 : 0.89)));
          pan = { x: x - ((x - pan.x) * scale) / old, y: y - ((y - pan.y) * scale) / old };
          world.scale.set(scale);
          world.position.set(pan.x, pan.y);
        };
        const point = (e: PointerEvent) => {
          const r = element.getBoundingClientRect();
          return {
            x: (e.clientX - r.left - pan.x) / scale,
            y: (e.clientY - r.top - pan.y) / scale,
          };
        };
        const down = (e: PointerEvent) => {
          const p = point(e);
          let best: Aircraft | undefined,
            dist = 22 / scale;
          for (const a of latest.current.state.aircraft) {
            const d = Math.hypot(a.position.x - p.x, a.position.y - p.y);
            if (d < dist) {
              best = a;
              dist = d;
            }
          }
          if (best) {
            latest.current.onSelect(best.id);
            return;
          }
          for (const [id, label] of labels) {
            if (
              id.startsWith('AC') &&
              label.visible &&
              p.x >= label.x &&
              p.x < label.x + label.width &&
              p.y >= label.y &&
              p.y < label.y + label.height
            ) {
              latest.current.onSelect(id);
              draggedLabel = id;
              app!.canvas.setPointerCapture(e.pointerId);
              return;
            }
          }
          drag = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
          app!.canvas.setPointerCapture(e.pointerId);
        };
        const move = (e: PointerEvent) => {
          revision++;
          if (draggedLabel) {
            const a = latest.current.state.aircraft.find((a) => a.id === draggedLabel);
            if (a) {
              const p = point(e);
              offsets.set(a.id, { x: p.x - a.position.x, y: p.y - a.position.y });
            }
            return;
          }
          if (drag) {
            pan = { x: drag.px + e.clientX - drag.x, y: drag.py + e.clientY - drag.y };
            world.position.set(pan.x, pan.y);
          }
        };
        const up = () => {
          drag = null;
          draggedLabel = null;
        };
        element.addEventListener('wheel', wheel, { passive: false });
        app.canvas.addEventListener('pointerdown', down);
        app.canvas.addEventListener('pointermove', move);
        app.canvas.addEventListener('pointerup', up);
        cleanup = () => {
          element.removeEventListener('wheel', wheel);
          app?.canvas.removeEventListener('pointerdown', down);
          app?.canvas.removeEventListener('pointermove', move);
          app?.canvas.removeEventListener('pointerup', up);
        };
        function label(id: string, text: string, x: number, y: number, color: number, size = 10) {
          let t = labels.get(id);
          if (!t) {
            t = new Text({
              resolution: 2,
              text,
              style: { fontFamily: 'monospace', fontSize: size, fill: color, lineHeight: size + 4 },
            });
            labels.set(id, t);
            texts.addChild(t);
          }
          if (t.text !== text) t.text = text;
          if (t.style.fill !== color) t.style.fill = color;
          if (t.style.fontSize !== size) t.style.fontSize = size;
          t.position.set(x, y);
          t.visible = true;
          return t;
        }
        app.ticker.add(() => {
          const { state: s, selected, network, showLabels } = latest.current;
          const drawKey = `${s.clock.tick}/${selected}/${network}/${showLabels}/${revision}/${s.combinedSectors.join()}`;
          if (drawKey === lastDraw) return;
          lastDraw = drawKey;
          if (previousNetwork !== network) {
            previousNetwork = network;
            fit();
          }
          geometry.clear();
          dynamic.clear();
          for (const l of labels.values()) l.visible = false;
          // Original cartographic silhouette: deliberately schematic and not an aviation chart.
          geometry
            .moveTo(0, 130)
            .lineTo(42, 72)
            .lineTo(145, 35)
            .lineTo(230, 45)
            .lineTo(307, 30)
            .lineTo(390, 53)
            .lineTo(480, 36)
            .lineTo(570, 50)
            .lineTo(667, 34)
            .lineTo(754, 75)
            .lineTo(795, 136)
            .lineTo(775, 225)
            .lineTo(800, 302)
            .lineTo(726, 338)
            .lineTo(655, 326)
            .lineTo(579, 346)
            .lineTo(491, 328)
            .lineTo(411, 363)
            .lineTo(340, 341)
            .lineTo(285, 360)
            .lineTo(220, 317)
            .lineTo(163, 330)
            .lineTo(104, 290)
            .lineTo(57, 309)
            .lineTo(30, 228)
            .lineTo(0, 205)
            .closePath()
            .fill({ color: 0x122229, alpha: 0.65 })
            .stroke({ color: 0x304852, width: 1 / scale });
          for (let x = 0; x <= 800; x += 50)
            geometry
              .moveTo(x, 0)
              .lineTo(x, 380)
              .stroke({ color: 0x23343c, alpha: 0.25, width: 0.5 / scale });
          for (let y = 0; y <= 380; y += 50)
            geometry
              .moveTo(0, y)
              .lineTo(800, y)
              .stroke({ color: 0x23343c, alpha: 0.25, width: 0.5 / scale });
          for (const sector of dataset.sectors) {
            const owned = s.combinedSectors.includes(sector.id);
            geometry
              .poly(sector.polygon.flatMap((p) => [p.x, p.y]))
              .fill({ color: owned ? 0x335c63 : 0x14242c, alpha: owned ? 0.12 : 0.025 })
              .stroke({
                color: owned ? 0x6e9b9e : 0x38515f,
                width: (owned ? 1.2 : 0.7) / scale,
                alpha: owned ? 0.9 : 0.6,
              });
            label(
              `SEC${sector.id}`,
              `${sector.name}${owned ? ' / ACTIVE' : ''}`,
              sector.polygon[0].x + 12,
              sector.polygon[0].y + 12,
              owned ? 0x829f9f : 0x4f6c7a,
              9 / scale,
            );
            if (network) {
              const ac = s.aircraft.filter((a) => a.sectorId === sector.id);
              const conflicts = s.conflicts.filter((c) =>
                c.aircraftIds.some((id) => ac.some((a) => a.id === id)),
              ).length;
              label(
                `NET${sector.id}`,
                `${String(ac.length).padStart(2, '0')} TRAFFIC\n${conflicts} CONFLICTS\n${ac.filter((a) => a.controlState === 'INBOUND').length} INBOUND`,
                sector.center.x - 35,
                sector.center.y - 20,
                conflicts ? 0xe9ae8e : 0xacc9ca,
                13 / scale,
              );
            }
          }
          for (const cell of s.weather) {
            geometry
              .ellipse(cell.x, cell.y, cell.radiusNm, cell.radiusNm * 0.75)
              .fill({ color: 0x9b773e, alpha: 0.11 })
              .stroke({ color: 0xb18c4d, alpha: 0.35, width: 1 / scale });
            geometry
              .ellipse(cell.x + 5, cell.y - 3, cell.radiusNm * 0.6, cell.radiusNm * 0.4)
              .fill({ color: 0xa68b51, alpha: 0.09 });
            label(cell.id, 'CB', cell.x - 7, cell.y - 5, 0xa28c63, 9 / scale);
          }
          for (const fix of dataset.waypoints) {
            geometry
              .poly([fix.x, fix.y - 2, fix.x + 2, fix.y + 2, fix.x - 2, fix.y + 2])
              .stroke({ color: 0x527181, width: 0.7 / scale });
            if (scale > 1.15 && !network)
              label(`FIX${fix.id}`, fix.id, fix.x + 5, fix.y + 2, 0x527181, 8 / scale);
          }
          const chosen = s.aircraft.find((a) => a.id === selected);
          if (chosen) {
            let prev = chosen.position;
            for (const id of chosen.routeIntent.slice(chosen.nextWaypoint)) {
              const wp = dataset.waypoints.find((w) => w.id === id);
              if (wp) {
                dynamic
                  .moveTo(prev.x, prev.y)
                  .lineTo(wp.x, wp.y)
                  .stroke({ color: 0x86cbbb, alpha: 0.65, width: 1 / scale });
                label(`ROUTE${id}`, id, wp.x + 4, wp.y - 13, 0x91bfaf, 10 / scale);
                prev = wp;
              }
            }
          }
          for (const c of s.conflicts.filter((c) => c.aircraftIds.includes(selected ?? ''))) {
            dynamic
              .circle(c.point.x, c.point.y, 5 / scale)
              .stroke({ color: 0xe9b175, width: 1 / scale });
            label(
              `CPA${c.id}`,
              `CPA ${Math.round(c.closestTimeSec)}s / ${c.closestDistanceNm.toFixed(1)}NM`,
              c.point.x + 8,
              c.point.y,
              0xe5b687,
              10 / scale,
            );
          }
          const occupied: { x: number; y: number; w: number; h: number }[] = [];
          for (const a of [...s.aircraft].sort(
            (a, b) => Number(b.id === selected) - Number(a.id === selected),
          )) {
            const sel = a.id === selected,
              alert = s.alerts.some((c) => c.aircraftIds.includes(a.id)),
              abnormal = a.emergency.kind !== 'NONE' && !a.emergency.resolved,
              owned = s.combinedSectors.includes(a.owner ?? '');
            const color = alert
              ? 0xf29b91
              : sel
                ? 0xbce9d7
                : abnormal
                  ? 0xe8bd80
                  : a.controlState === 'INBOUND'
                    ? 0xe3c98f
                    : owned
                      ? 0xa6c7ce
                      : 0x658493;
            for (let i = 0; i < a.trail.length; i++) {
              const p = a.trail[i];
              dynamic
                .circle(p.x, p.y, 0.8 / scale)
                .fill({ color, alpha: 0.1 + (i / a.trail.length) * 0.5 });
            }
            const v = vector(a.trackDeg, a.groundSpeedKt);
            dynamic
              .moveTo(a.position.x, a.position.y)
              .lineTo(a.position.x + v.x * 60, a.position.y + v.y * 60)
              .stroke({ color, alpha: 0.7, width: 0.8 / scale });
            dynamic
              .rect(a.position.x - 2.5 / scale, a.position.y - 2.5 / scale, 5 / scale, 5 / scale)
              .stroke({ color, width: 1.2 / scale });
            if (sel)
              dynamic
                .circle(a.position.x, a.position.y, 8 / scale)
                .stroke({ color, width: 1 / scale });
            if (alert)
              dynamic
                .circle(a.position.x, a.position.y, 11 / scale)
                .stroke({ color, width: 1 / scale });
            if (!network && (showLabels || sel)) {
              const off = offsets.get(a.id) ?? { x: 13 / scale, y: -24 / scale };
              let x = a.position.x + off.x,
                y = a.position.y + off.y;
              const w = 102 / scale,
                h = 30 / scale;
              if (!offsets.has(a.id))
                for (
                  let tries = 0;
                  tries < 6 &&
                  occupied.some(
                    (o) => x < o.x + o.w && x + w > o.x && y < o.y + o.h && y + h > o.y,
                  );
                  tries++
                )
                  y += 34 / scale;
              occupied.push({ x, y, w, h });
              const status = alert
                ? ' !'
                : abnormal
                  ? ' △'
                  : a.controlState === 'INBOUND'
                    ? ' IN'
                    : a.controlState === 'TRANSFER_INITIATED'
                      ? ' XFR'
                      : '';
              label(
                a.id,
                `${a.callsign}${status}\n${Math.round(a.altitudeFt / 100)
                  .toString()
                  .padStart(
                    3,
                    '0',
                  )}${a.verticalMode === 'CLIMB' ? '↑' : a.verticalMode === 'DESCEND' ? '↓' : ' '} ${a.clearedAltitudeFt / 100}  ${Math.round(a.groundSpeedKt / 10)}`,
                x,
                y,
                color,
                12 / scale,
              );
              dynamic
                .moveTo(a.position.x, a.position.y)
                .lineTo(x - 3 / scale, y + 11 / scale)
                .stroke({ color, alpha: 0.5, width: 0.6 / scale });
            }
          }
          for (const [id, l] of labels)
            if (id.startsWith('AC') && !s.aircraft.some((a) => a.id === id)) {
              l.destroy();
              labels.delete(id);
            }
        });
      } catch (e) {
        if (!disposed)
          setError(
            `Radar renderer unavailable: ${e instanceof Error ? e.message : 'WebGL required'}. Try a browser with hardware acceleration.`,
          );
      }
    })();
    return () => {
      disposed = true;
      observer?.disconnect();
      cleanup();
      if (app?.renderer) app.destroy(true, { children: true });
    };
  }, []);
  return (
    <div className="radar-host" ref={host}>
      {error && (
        <div className="renderer-error" role="alert">
          {error}
        </div>
      )}
      <div className="radar-coordinate">
        SCHEMATIC ANATOLIA / NM GRID
        <br />
        <span>ORIGINAL SIMULATION DATA · NOT FOR NAVIGATION</span>
      </div>
      <div className="zoom-controls">
        <button aria-label="Zoom in" onClick={() => zoomAction.current(1.2)}>
          +
        </button>
        <button aria-label="Zoom out" onClick={() => zoomAction.current(0.8)}>
          −
        </button>
        <button aria-label="Fit radar" onClick={() => zoomAction.current(0)}>
          ⌖
        </button>
      </div>
      <div className="range-key">
        <span />
        50 NM · PAN / SCROLL TO ZOOM
      </div>
    </div>
  );
}
