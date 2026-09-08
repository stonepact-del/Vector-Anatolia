# UI system

A radar-first operational canvas with original styling. No proprietary controller workstation is reproduced.

## Composition

The fixed top bar carries the product identity, active position, simulated UTC, traffic count, time multiplier and pause. Tactical/network switches sit inside the scope. The collapsible flight list is the keyboard-accessible alternative to canvas selection. The selected-aircraft strip exposes common instructions and a deterministic command input remains available along the bottom.

Briefing is a scenario list with a concise operational description, density, duration and seed. During gameplay the briefing does not occupy the canvas. Ending a shift produces safety, flow, coordination and efficiency metrics with a major-event timeline.

## Visual language

- Background `#0b1318`, panels `#14232b`, restrained linework.
- Mint `#aed9c7`: selected/active controls.
- Amber: inbound or abnormal traffic.
- Warm red: STCA and separation loss, with explicit text and an exclamation symbol.
- Muted blue-gray: surrounding traffic and secondary cartography.
- System sans-serif for controls; monospace for flight data, clock and command entry.

Flight labels show callsign, actual flight level, trend, cleared level and groundspeed in tens of knots. The inspector resolves detailed IAS/TAS-related information and ownership. Labels can be dragged, and automatic placement reduces overlaps. Network mode suppresses tutorial overlays and selected-route annotations to preserve sector-summary readability. Target history and a one-minute velocity vector aid trend reading. Selected intent is emphasized; optional CPA details do not recommend a resolution.

## Interaction and accessibility

Click a target or flight row, then LEVEL → level, DIRECT → fix, HEADING → heading, SPEED → IAS/Mach, or TRANSFER → adjacent sector → CONTACT. Full-precision heading input is available through command entry. Disabled choices carry explanations, and WHY opens the modeled procedure context.

Keyboard: Tab for normal controls, Alt+Tab for next aircraft (some operating systems reserve this shortcut), `/` for command focus, Space for pause, Escape to clear selection. The normal flight list remains the reliable keyboard path where system shortcuts intercept input. Focus rings, semantic buttons and non-color alert symbols are included. Reduced motion respects both the browser preference and local setting.

Primary target is desktop/laptop. Tablet layouts reduce surrounding panels. Phone gameplay is not a design target. Canvas labels remain visually specialized; the DOM flight list and inspector provide equivalent selectable aircraft information.
