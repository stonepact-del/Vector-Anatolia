# ANKARA CONTROL

**Türkiye Area Control Simulator** — an original, offline, browser-based area-control simulation. Open a shift, identify and control traffic, manage developing conflicts, coordinate transfers, respond to abnormal events, then review your decisions in a local replay.

**UNOFFICIAL. Not affiliated with DHMİ, ICAO or EUROCONTROL. Not suitable for navigation or operational air traffic control. Not a certified ATC training system. For entertainment and education only.**

## Run locally

Use Node.js 22 or newer (development verified with Node 24) and npm:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

`lint` checks formatting with Prettier; strict TypeScript supplies static type checks. `npm run format` applies formatting. The production output is `dist/`.

For browser tests:

```sh
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
npm run test:offline
```

Playwright starts the required local server. Installing Chromium and its Linux system libraries may need network/system permission. These are development dependencies, not application runtime services.

## Play

1. Start **Quiet Sector** for the guided tutorial. Select the inbound THY flight in the radar or flight list.
2. **ACCEPT**, then **IDENTIFY**, establishes modeled communication, exclusive ownership and target identification.
3. Select **LEVEL**, **DIRECT**, **HEADING** or **SPEED**. Aircraft respond after a readback delay and maneuver gradually.
4. **TRANSFER** coordinates with an adjacent sector; **CONTACT** completes the ownership transfer.
5. Watch planning conflicts and the separate STCA-style safety net. Use **WHY?** to inspect the modeled rules, not an automatic resolution.
6. Finish the shift for a safety-first report and local replay.

Structured commands invoke the same domain engine as buttons. For the actual selected callsign, examples are `THY961A CLIMB FL370`, `THY961A DIRECT SIMCA`, `THY961A HEADING 090`, and `THY961A SPEED M080`. Input suggestions explain syntax. Fixes beginning with `SIM` are explicitly fictional.

Space pauses, `/` focuses command input, Escape clears selection, and the normal Tab order exposes the flight list and controls. Alt+Tab cycles aircraft where the operating system does not intercept it. Pan by dragging empty radar space; scroll to zoom. Labels can be dragged independently.

## Included content

- Ten scenarios: Quiet Sector, Normal Ops, Istanbul Flow, Summer Rush, Transit Wave, Thunderstorm Deviations, Communication Failure, Medical Diversion, Sector Overload, and Night FRA.
- Low, standard and busy traffic density; 15-, 30- and 60-minute shifts; reproducible seeds.
- Five aircraft performance categories and ten representative aircraft type codes.
- Eight synthetic geographic sectors with lower/upper layer definitions; initial positions combine those layers.
- Tactical radar and a functional network view with traffic, inbound and conflict counts plus selectable/combined positions.
- Procedural weather requests, two dedicated abnormal missions, versioned modeled nighttime FRA applicability, delayed clearances, identification and handoffs.
- Reports, major-event timelines, deterministic replay with seek, local progress/settings, and data export/import/reset.
- Installable PWA metadata, original icons and a production offline cache.

## Architecture

React presents controls and reports. A dedicated Web Worker owns the deterministic simulation. Aircraft integrate at a fixed **250 ms timestep**, independent of PixiJS rendering. A seeded generator creates traffic; the action log preserves commands, rejected attempts, position changes and shift completion. Prediction uses the same motion intent and fixed-step aircraft model.

PixiJS renders a local WebGL radar with no map service. IndexedDB stores settings, progress and up to 20 replays. No backend, account, database service, analytics, live aircraft feed, AI API or weather API is required. No ADS-B or live schedules are consumed.

Important code:

- [Domain and provider contracts](src/domain/types.ts)
- [Simulation orchestration](src/simulation/engine.ts), [clearances](src/simulation/commands.ts), [conflicts](src/simulation/conflicts.ts)
- [Worker and scheduler](src/workers/simulation.worker.ts)
- [Radar renderer](src/rendering/Radar.tsx)
- [Original dataset and scenarios](src/data/index.ts)
- [Local persistence](src/persistence/store.ts)

## Procedural fidelity and licensing

DHMİ AIP sections, publicly accessible ICAO material and EUROCONTROL STCA guidance inform the models. Source inspection does **not** establish complete current amendment applicability. No implemented operational rule is claimed `VERIFIED` in this release. Published concepts and conservative modeled behavior are distinguished in typed provenance records and the in-app **Simulation Fidelity** section.

All bundled sector geometry, fixes, routes, schedules, performance numbers, weather and map artwork are original synthetic/modelled material. No AIP PDF, chart, extracted navigation table, airline logo or proprietary controller UI is redistributed. Providers separate dataset content from domain concepts so an authorized replacement can be integrated without redesigning the simulation.

Read:

- [Architecture](docs/architecture.md)
- [Procedural fidelity and source matrix](docs/procedural-fidelity.md)
- [Data licensing and replacement strategy](docs/data-licensing.md)
- [Simulation model and measured limits](docs/simulation-model.md)
- [UI system](docs/ui-system.md)
- [V1 verification record](docs/verification.md)
- [Runtime dependency notices](public/third-party-notices.txt)

## Static deployment and offline behavior

Deploy the complete `dist/` directory to any static HTTPS host. Relative asset paths support subdirectory hosting. No secrets or environment variables are needed. The build generates a content-versioned service worker and precaches the app, worker, renderer chunks, icons and documentation. After the cache is installed, gameplay works offline. Close existing tabs to activate a newly deployed version safely.

A first visit still requires downloading the site. HTTPS or localhost is required for service workers; opening `index.html` through a file URL is unsupported. Browser storage can be cleared or evicted, so export important recordings. Imports accept up to 128 MiB and are validated before replacing local data. Source links are optional external reading, never gameplay dependencies.

## Current limits

This is an en-route entertainment simulation, not an operational digital twin. The schematic network does not reproduce certified Ankara ACC sector boundaries. FRA uses a dated 27 November 2025 publication snapshot, not a live AIRAC service. Neighboring coordination, radio identification, phraseology and abnormal procedures are simplified; neighboring units do not implement a complete tactical controller AI. Separate staffing of vertical layers, terminal/runway operations, terrain/obstacle clearance, full military exceptions and certified aircraft performance are outside V1.

English is the initial interface language. Desktop/laptop is the primary target, with tablet degradation; WebGL is required. Replays are version-bound. Very dense traffic can reduce effective simulation speed, particularly at 4×; the engine preserves physics steps instead of skipping them. The 300-aircraft benchmark reports measured host-dependent costs and is not a guarantee of 300-aircraft real-time operation on every device.
