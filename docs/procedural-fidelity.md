# Procedural fidelity

ANKARA CONTROL is unofficial entertainment/education software. It is not affiliated with DHMİ, ICAO or EUROCONTROL, not suitable for navigation or operational ATC, and not a certified ATC training system.

## Evidence policy

Research originally performed 7 September 2026 and re-audited **8 September 2026** for Living Airspace. A reachable document is evidence of its contents, not proof that it is the complete currently effective publication. The DHMİ PDFs include pages carrying older amendment dates, and a full amendment/SUP/AIC reconciliation was not possible through the public collection. Consequently **no implemented operational rule is labeled VERIFIED**. The only new `VERIFIED` metadata concerns Natural Earth's public-domain geographic-source license, not an ATC rule.

`VERIFIED` requires applicable, effective source evidence. `MODELED` identifies original parameters or unconfirmed applicability. `SIMPLIFIED` identifies a documented reduction. `UNKNOWN` marks insufficient evidence. Runtime rule records include all these possible statuses, source URL, effective date, inspection date and notes. The in-app fidelity view mirrors these records.

## Rule/source matrix

| Rule | Evidence consulted | Implemented behavior | Fidelity |
|---|---|---|---|
| Horizontal radar separation | [DHMİ ENR 1.6 §4.1](https://www.dhmi.gov.tr/AIPDocuments/LT_ENR_1_6_en.pdf) | 5 NM; equality is separated | MODELED: published value, current applicability not fully reconciled |
| Vertical separation / RVSM | [DHMİ ENR 1.7 §3.2](https://www.dhmi.gov.tr/AIPDocuments/LT_ENR_1_7_en.pdf), [ICAO RVSM concept](https://www.icao.int/rvsm-home) | 1,000 ft below FL290; 1,000 ft for eligible pairs entirely within FL290–410; otherwise 2,000 ft within this simulator's envelope | MODELED: conservative mixed-band handling; no military exceptions |
| Identification | [DHMİ ENR 1.6 §3](https://www.dhmi.gov.tr/AIPDocuments/LT_ENR_1_6_en.pdf) | Accept correlation, explicitly identify, then issue surveillance commands | MODELED; correlation and identification exchange simplified |
| Initial contact / radio establishment | ENR 1.6 radar-service and identification context | Expected target, accepted handoff, queued initial call, correlated target, explicit identification | SIMPLIFIED simulator lifecycle; not a Turkish unit procedure or frequency model |
| Voice readback | [ICAO PANS-ATM public-copy §4.5.7.5](https://applications.icao.int/tools/ATMiKIT/story_content/external_files/story_content/external_files/DOC%204444_PANS%20ATM_en.pdf) was consulted; the public endpoint was unavailable on the final audit date | Level, heading, speed and route instructions enter a structured readback queue; discrepancies are corrected before execution | MODELED; current edition/applicability unverified, timing and variation original |
| Speed control | [DHMİ ENR 1.6 §5](https://www.dhmi.gov.tr/AIPDocuments/LT_ENR_1_6_en.pdf) | IAS or Mach targets, delay, gradual acceleration, performance validation | MODELED; atmosphere is approximate |
| Flight levels | [DHMİ ENR 1.7](https://www.dhmi.gov.tr/AIPDocuments/LT_ENR_1_7_en.pdf) | FL140 through type ceiling; whole thousands; FL430/450 above FL410; no non-RVSM cruise authorization in RVSM band | MODELED; direction-specific route level constraints omitted |
| FRA applicability | [DHMİ ENR 1.3 §5](https://www.dhmi.gov.tr/AIPDocuments/LT_ENR_1_3_en.pdf), page dated 27 NOV 2025 | Scenario calendar pinned to 27 November 2025; 20:00–02:00 UTC and FL305–660 eligibility; actual aircraft ceilings remain lower | MODELED published snapshot; not current AIRAC guidance |
| FRA significant points | [DHMİ ENR 4.4 legend](https://www.dhmi.gov.tr/AIPDocuments/LT_ENR_4_4_en.pdf) | Original synthetic entry/exit/intermediate/connecting points; direct-route validation; interior boundary constraint | MODELED; official points and restrictions not copied |
| Planning prediction | Original implementation | Five-minute intent trajectory prediction | MODELED |
| STCA-style alert | [EUROCONTROL STCA guidelines, 2017](https://www.eurocontrol.int/publication/eurocontrol-guidelines-short-term-conflict-alert-stca) | Separate 120-second alert horizon; episode accounting | MODELED; not SMART or DHMİ thresholds |
| Handoffs | [EUROCONTROL Coordination and Transfer Guidelines v2.0, 27 June 2023](https://www.eurocontrol.int/publication/guidelines-coordination-and-transfer-control-atc), plus transfer-of-identification context in ENR 1.6 | Notification, acceptance, initial call, outbound offer, receiving acceptance, contact and exclusive owner | MODELED; sector agents, load formula and delays are original, no Letter of Agreement reproduced |
| Frequency occupancy | General voice-communication/readback concepts | Deterministic single-channel queue, template-length occupancy, priority and rolling load | MODELED; no real frequency, channel capacity or operational threshold |
| Pilot requests | ENR 1.6 §5.1.3 unable-speed concept and general ATC request concepts | Condition-driven higher/direct/weather/diversion/return-route requests; approve, deny or modified clearance | MODELED; generation thresholds and template wording are original |
| Communication failure | [DHMİ ENR 1.6 §7](https://www.dhmi.gov.tr/AIPDocuments/LT_ENR_1_6_en.pdf) | Radio commands fail; last accepted intent continues; surrounding traffic remains controllable | MODELED; not a full lost-communication procedure |
| Medical urgency / weather | [ICAO ATM public overview](https://www.icao.int/air-traffic-management-atm), [DHMİ ENR 1.3](https://www.dhmi.gov.tr/AIPDocuments/LT_ENR_1_3_en.pdf) | Urgency request, changed destination/route request, acknowledgment and diversion/deviation clearances | MODELED; ATC side only |
| Performance, workload and scoring | Original product model | Category envelopes, deterministic state-derived workload, safety-first report | MODELED |
| Traffic demand / adjacent-sector load | Original product model | Quiet/building/busy/peak/recovery demand curve; bounded sector agents delay coordination | MODELED |

## Other sections reviewed and limits

[DHMİ GEN 3.3](https://www.dhmi.gov.tr/AIPDocuments/LT_GEN_3_3_en.pdf), [ENR 1.8](https://www.dhmi.gov.tr/AIPDocuments/LT_ENR_1_8_en.pdf), [ENR 1.10](https://www.dhmi.gov.tr/AIPDocuments/LT_ENR_1_10_en.pdf) and [ENR 2.1](https://www.dhmi.gov.tr/AIPDocuments/LT_ENR_2_1_en.pdf) were opened for service, supplementary procedure, flight-planning and airspace context. No geometry or tables were extracted into the application. ENR 3.1 and the attempted ENR 6.1 chart endpoint did not return usable material during research; no claims depend on them.

[EUROCONTROL's national AIRAC publication review](https://www.eurocontrol.int/directory/national-airac-publication-review) identifies Türkiye amendment 09/26 against 3 September 2026. It is an index, not verification of each rule. The DHMİ announcement about future full-time FRA was treated as an announcement, not an effective rule.

This release does not simulate approach minima, terrain clearance, runway operations, radar outages, ACAS resolution advisories, military exceptions, real frequencies, certified aircraft performance, or the complete ICAO radiotelephony manual. Do not use any interface, model or example from this project to control or navigate real aircraft.
