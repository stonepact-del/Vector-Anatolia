# V1 verification record

Final verification: 8 September 2026, Linux Codespaces, Node 24.20.0, Chromium through Playwright with software WebGL. This record covers the original V1; no Living Airspace expansion is included.

## Automated checks

- Clean `npm ci`: passed; zero reported dependency vulnerabilities at installation.
- `npm run typecheck`: passed.
- `npm run lint`: passed (Prettier formatting check).
- `npm test`: 83 tests passed across four files.
- `npm run test:e2e`: five browser tests passed.
- `npm run build`: passed; static worker, renderer assets, documentation and dependency notices precached.
- `npm run test:offline`: production reload and simulation with the network disconnected verified separately.

The unit suite exercises fixed-timestep independence across render rates, seeded scenarios, aircraft response, geospatial and sector calculations, exclusive ownership, clearances/readbacks, threshold boundaries, RVSM, swept separation, intent prediction, FRA activation/point roles, weather and radio/medical states, replay reconstruction/checksums, corrupt imports and replacement dataset injection. All ten scenario families receive deterministic finite-state checks. A 300-aircraft benchmark is measured, not a real-time performance guarantee: the final run under concurrent browser load took 1.31 seconds for prediction and 1.21 seconds per simulated second.

Browser flows cover tutorial acceptance/identification, button and typed clearances, delayed execution, transfer/contact, pause/speed, conflict alerts, medical urgency, report completion, saved replay/reload/seek, network view, settings persistence and invalid-import recovery. The offline test rejects external runtime requests and page errors. Gameplay tests check page errors in their exercised flows.

## Visual and interaction review

Inspected real Chromium screenshots at 1440×900, 1366×768, 1920×1080 and 1024×768. Reviewed briefing, selected aircraft, level chooser, tactical conflict state, paused network, and shift report. Automated layout checks found no document-width overflow. Semantic controls, keyboard activation, visible focus, reduced-motion settings and modal focus management are implemented. Radar labels can be repositioned and the scope panned/zoomed; very dense labels still require controller attention. This is not a formal assistive-technology certification or exhaustive cross-browser audit.

## Stabilization changes

- Isolated gameplay/offline test artifacts to prevent trace cleanup collisions.
- Corrected offline cache matching for static responses with `Vary: Origin`.
- Hardened replay/import validation and end-state verification; preserved rejected actions and position changes.
- Removed dataset-specific engine assumptions; tested renamed and translated replacement data.
- Corrected first-boundary handoff routing, FRA role/activation checks, communication-failure acceptance, and abnormal-state resolution conditions.
- Improved prediction candidate coverage, finite-state checks, traffic entry safety and pilot-response feedback.
- Reduced redundant radar rendering and corrected overlapping network/tutorial overlays.
- Included runtime dependency license notices and normalized their formatting.

## Release boundaries

The provenance audit claims no implemented operational rule VERIFIED. Published concepts remain MODELED or SIMPLIFIED because complete current amendment reconciliation was not established. All bundled airspace/navigation/performance content is synthetic. No AIP PDFs, charts or extracted navigation tables are distributed. See [procedural fidelity](procedural-fidelity.md), [licensing](data-licensing.md) and [simulation limits](simulation-model.md).

Build output, browser screenshots, traces and installed dependencies are ignored, not source deliverables. The final diff whitespace check passes. The static application needs no external runtime API. First-time installation/cache population requires downloading the site; subsequent offline operation requires supported browser storage and WebGL.
