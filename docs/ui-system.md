# UI system

A radar-first operational canvas with original styling. No proprietary controller workstation is reproduced.

## Composition

The fixed top bar carries the Living Airspace identity, active position, simulated UTC, traffic count, demand phase/challenge code, time multiplier and pause. Tactical/network switches sit inside the scope. The compact right rail orders ATTENTION, flight list/selected details, and RADIO. It remains collapsible. The selected-aircraft strip exposes only commands valid for lifecycle state; the deterministic command input remains available along the bottom.

Briefing is a scenario list with a concise operational description, density, duration and seed. During gameplay the briefing does not occupy the canvas. Ending a shift produces safety, flow, coordination and efficiency metrics with a major-event timeline.

## Visual language

- Background `#0b1318`, panels `#14232b`, restrained linework.
- Mint `#aed9c7`: selected/active controls.
- Amber: inbound or abnormal traffic.
- Warm red: STCA and separation loss, with explicit text and an exclamation symbol.
- Muted blue-gray: surrounding traffic and secondary cartography.
- System sans-serif for controls; monospace for flight data, clock and command entry.

Flight labels show callsign, actual flight level, trend, cleared level and groundspeed in tens of knots. Compact suffixes distinguish approaching/advance notification (`AP`), handoff offer (`HO`), initial call (`IC`), request (`RQ`), transfer (`XFR`) and safety/abnormal states. Text and shape accompany color. The inspector resolves exact lifecycle, request, radio, performance and ownership detail. Labels can be dragged and automatic placement reduces overlaps. Network mode shows traffic, conflicts, inbound count and modeled frequency load per sector while suppressing tactical overlays.

## Interaction and accessibility

Click a target or attention item. An offered inbound exposes ACCEPT; after its queued initial call, IDENTIFY becomes available. A controlled flight exposes LEVEL, DIRECT, HEADING, SPEED and TRANSFER. Pilot requests expose APPROVE REQUEST and DENY; a specific tactical clearance can answer with a modification. CONTACT appears only after deterministic adjacent-sector acceptance. Full-precision heading input remains available through command entry. Disabled choices carry explanations, and WHY opens the modeled procedure context.

Keyboard: Tab for normal controls, Alt+Tab for next aircraft (some operating systems reserve this shortcut), `/` for command focus, Space for pause, Escape to clear selection. The normal flight list remains the reliable keyboard path where system shortcuts intercept input. Focus rings, semantic buttons and non-color alert symbols are included. Reduced motion respects both the browser preference and local setting.

Primary target is desktop/laptop. Tablet layouts reduce surrounding panels. Phone gameplay is not a design target. Canvas labels remain visually specialized; the DOM flight list and inspector provide equivalent selectable aircraft information.
