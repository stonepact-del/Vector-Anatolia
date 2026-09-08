# Data licensing and provenance

Public viewing does not establish permission to redistribute aeronautical data. [Türkiye AIP GEN 0.1 §5](https://www.dhmi.gov.tr/AIPDocuments/LT_GEN_0_1_en.pdf), inspected 7 September 2026, states that the publication is copyright protected and restricts reuse outside applicable copyright law without permission. This repository does not claim a redistribution license for it.

| Required material | Source considered | Licensing / bundled decision | Transformation and replacement |
|---|---|---|---|
| FIR/sector geometry | DHMİ ENR 2.1 and charts | No redistribution permission established; not bundled | Eight original rectangular sectors and original schematic silhouette; neither digitized nor transformed from a chart |
| Fixes, routes, FRA points | DHMİ ENR 3 / ENR 4.4 | No navigation table bundled | Original `SIMxx` points in a local NM plane, original route families; no claimed coordinate equivalence |
| Procedure rules | DHMİ AIP, ICAO public overviews, EUROCONTROL STCA guidance | Only source links, short original summaries and modeled rules bundled | No PDFs, chart images or bulk text; confirm applicability and permission before expanding |
| Performance | Potential certified manufacturer or proprietary performance datasets | No external performance dataset used | Original five-category approximations; replace through performance provider |
| Schedules / aircraft positions | None | No live source, schedule scrape or API | Seeded original synthetic flights |
| Names / type identifiers | Ordinary aircraft and airport identifiers | Text labels only; no logos or endorsement | Identifiers provide context, not licensed performance data |
| Weather | None | Original procedural data | Seeded cells; no weather API |
| Map artwork / app mark | Created in this repository | Original SVG and renderer paths bundled | Schematic artwork; not a chart and not traced from a proprietary UI |
| Fonts | Browser system font stack | No font files downloaded | Uses locally installed Arial / sans-serif / monospace |
| Dependencies | npm packages in lockfile | React, Vite, TypeScript, PixiJS, idb and test/build tooling under their respective licenses | Preserve dependency notices when redistributing bundled software |

The application has typed `AirspaceDataProvider`, `NavigationDataProvider`, `ProcedureDataProvider`, and `AircraftPerformanceProvider` contracts. A future authorized provider must supply the same domain units, dataset identity, version, content hash and fidelity metadata. Never silently substitute data under an existing replay version. Replace synthetic geometry and navigation together, validate every route reference, and run the full separation/replay suite. The engine accepts an injected aggregate dataset containing these providers’ data and preserves that snapshot in replay. A regression test replaces both identifiers and geometry without changing engine code. No authorization to redistribute AIP content is inferred from the existence of these interfaces.

Scenario date and dataset version are separate from real AIRAC identity. The supplied `ANATOLIA-SIM` dataset must remain labeled synthetic. Source pages are linked for user-initiated reading; gameplay never requests them.
