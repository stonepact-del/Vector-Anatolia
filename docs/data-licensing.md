# Data licensing and provenance

Public viewing does not establish permission to redistribute aeronautical data. [Türkiye AIP GEN 0.1 §5](https://www.dhmi.gov.tr/AIPDocuments/LT_GEN_0_1_en.pdf), inspected 7 September 2026, states that the publication is copyright protected and restricts reuse outside applicable copyright law without permission. This repository does not claim a redistribution license for it.

| Required material | Source considered | Licensing / bundled decision | Transformation and replacement |
|---|---|---|---|
| Geographic Türkiye outline | [Natural Earth 1:110m Admin 0 Countries](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/) | Bundled; [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/) place all vector/raster versions on its site in the public domain | Türkiye feature extracted from the upstream GeoJSON, rounded, and projected into the local plane with an equirectangular approximation centered on Türkiye. This is geographic context, not navigation data |
| FIR/sector geometry | DHMİ ENR 2.1 and charts | No redistribution permission established; not bundled | Eight original, irregular Türkiye-inspired sectors; they are not digitized or transformed from an AIP chart |
| Fixes, routes, FRA points | DHMİ ENR 3 / ENR 4.4 | No navigation table bundled | Original `SIMxx` points in a local NM plane, original route families; no claimed coordinate equivalence |
| Procedure rules | DHMİ AIP, ICAO public overviews, EUROCONTROL STCA guidance | Only source links, short original summaries and modeled rules bundled | No PDFs, chart images or bulk text; confirm applicability and permission before expanding |
| Performance | Potential certified manufacturer or proprietary performance datasets | No external performance dataset used | Original five-category approximations; replace through performance provider |
| Schedules / aircraft positions | None | No live source, schedule scrape or API | Seeded original synthetic flights |
| Names / type identifiers | Ordinary aircraft and airport identifiers | Text labels only; no logos or endorsement | Identifiers provide context, not licensed performance data |
| Weather | None | Original procedural data | Seeded cells; no weather API |
| Operational landmarks | General geographic knowledge | Four approximate regional labels only | Istanbul, Ankara, Izmir and Antalya labels support orientation; no airport, runway, terrain or procedure geometry |
| App mark | Created in this repository | Original SVG bundled | Not an official or airline mark |
| Fonts | Browser system font stack | No font files downloaded | Uses locally installed Arial / sans-serif / monospace |
| Dependencies | npm packages in lockfile | React, Vite, TypeScript, PixiJS, idb and test/build tooling under their respective licenses | Preserve dependency notices when redistributing bundled software |

The application has typed `AirspaceDataProvider`, `NavigationDataProvider`, `ProcedureDataProvider`, and `AircraftPerformanceProvider` contracts. A future authorized provider must supply the same domain units, dataset identity, version, content hash and fidelity metadata. Never silently substitute data under an existing replay version. Replace synthetic geometry and navigation together, validate every route reference, and run the full separation/replay suite. The engine accepts an injected aggregate dataset containing these providers’ data and preserves that snapshot in replay. A regression test replaces both identifiers and geometry without changing engine code. No authorization to redistribute AIP content is inferred from the existence of these interfaces.

The geographic source is identified separately in `AIRACDataset.simulation.geographicSource`; its `VERIFIED` status applies only to the public-domain reuse statement and the identity of the source. It does not make the rendered outline suitable for navigation, establish a legal boundary, or verify any sector. The sector dataset remains `synthetic: true`.

Scenario date and dataset version are separate from real AIRAC identity. The supplied `ANATOLIA-SIM` dataset must remain labeled synthetic. Source pages are linked for user-initiated reading; gameplay never requests them.
