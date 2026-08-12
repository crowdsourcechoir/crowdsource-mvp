# OCTO Signal Layer

The OCTO Signal Layer interprets participation into realtime collective state.
It is not a voting engine, analytics dashboard, engagement tracker, or
preference system.

The Signal Layer listens to participation and exposes shared signal frames that
other OCTO layers can subscribe to:

- music systems
- visual systems
- spatial systems
- environmental response
- haptics
- emotional pacing

## Current foundation

The first implementation adapts the Resonance loop into an OCTO signal source.
Admin color fields and participant holds remain the Participation Layer surface.
The Signal Layer interprets those holds into collective state at:

```text
GET /api/octo/signal/current
```

## Signal frame

Current signal frames use:

```text
octo.signal.v0
```

and expose:

- active field
- field-level resonance
- resonance
- coherence
- density
- momentum
- tension/release
- attention
- interpretation summary

These values are realtime control signals, not judgments of participants.

## Interpretation principles

- `resonance` reflects sustained embodied holding in the active field.
- `coherence` reflects how much recent holding aligns with the active field.
- `density` reflects how much collective presence is showing up in the current
  window.
- `momentum` reflects the rate at which new holds are arriving.
- `tensionRelease` is a performative control signal for transitions, not a mood
  diagnosis.
- `attention` reflects gathered presence and should remain soft, never punitive.

## Design guardrails

- Do not expose identities in signal frames.
- Do not label outputs as votes, winners, rankings, or preferences.
- Prefer bounded 0..1 values so downstream systems can map signals safely.
- Keep interpretation fast enough for live response.
- Let future sources produce the same frame shape without copying Resonance UI.

## Near-term evolution

- Add more source adapters: voice, movement, spatial presence, silence.
- Add subscriptions once polling becomes too slow for live systems.
- Preserve the signal frame as the shared language between Participation,
  Composition, Environment, and Experience layers.
