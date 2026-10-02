# Song Garden — generative living world

Status: **strategy, sharpened.** Experiments A–C, regeneration, the leak clock, sound, pictures, and a language holding-place are built at `/lab/garden`. The public garden is not.
Related: [`architecture.md`](./architecture.md), [`persistent-world-spec.md`](./persistent-world-spec.md)
Supersedes the one-chant visit note: [`felt-garden-plan.md`](./felt-garden-plan.md)

The question is unchanged. What rules let a community grow a world whose history is visible, whose individual contributions stay meaningful, and whose form none of us, including its designers, completely knows in advance?

We design the grammar and the laws. We do not design the finished garden.

The engine is unchanged:

**ordered event log → contribution genome → birth conditions → organism → condition deposit → changed conditions for whoever comes next**

This pass sharpens the laws, the lab that is supposed to discover them, and the proof. Experiments A–C, regeneration, the leak clock, sound, pictures, and a language holding-place are built. The public garden is not.

---

## What changed in this pass

The previous strategy called the shared state a climate. That word pulls the picture toward weather. The state is **garden conditions**: a short vector of what previous participation has done to the world. Some of it may look like weather. Some of it is spacing, bend, or pulse. The smallest vector proposed here has three variables, not a meteorological set, and not the ten qualities in the brief.

Structural identity stays frozen at germination. Living behavior is a separate function of current conditions, computed when drawing, and left neutral in the first experiments. The architecture has a place for it so we do not paint ourselves into a statue.

“A stranger can match sounds to bodies” is demoted to a diagnostic. The success criterion is felt causality: the maker senses that the organism came from the gesture, and cannot reduce the rule to one slider.

The two-order test becomes a first-class lab view, World A beside World B, with the same genome highlighted in both. Experiments A–C are specified tightly enough to implement. Audio output, AI, compost, and the public visit stay out of that build. The log is shaped so they can arrive as new event types without a second architecture.

One challenge to the previous sequence: **the memory test does not need a microphone.** As soon as the grammar can draw, World A / World B can run on synthetic genomes. Voice is a separate risk. Blocking C on B would confuse a failed mapping with a failed memory.

---

## What the product is today

Song Garden V2 is a short visit over a designed picture. `WorldJourney` on `/e/[slug]` sits on `WorldStage`, which crossfades authored storyboard plates as one energy number rises. Contributions are dots. Other people are a caption. `applyMutation` adds a fixed increment. The same contributions in a different order produce the same energy, the same layers, and the same landmarks.

The microphone analyser records loudness and discards everything else. There is no canvas ecology and no synthesis engine. The stack is Next.js 14, React 18, and Framer Motion. `openai` and Runway already exist in the repo. Runway makes pictures of gardens. It is not a tool for this work.

`/e/[slug]` and `/g/[slug]` stay as they are. The grammar bench lives at `/lab/garden` and does not replace them.

### Experiment A, as built

`/lab/garden` is a local lab. It draws the rooted ribbon, and it can quantize a short recording into the genome that draws that ribbon. There is no model.

- **One** edits the six axes and a birth condition vector, and replays germination.
- **Sheet** shows the thirty Halton genomes, each born at zero.
- **Field** plants the published twelve in order. Coupling `0`, `0.5`, and `1` are one click. Reordering the log refolds the draft.
- The selected body shows its hash. The same genome, birth, and laws are expressed twice and compared to the drawn ribbon.
- Frame time is shown from the canvas loop.
- Laws include sway, the linear foil, the tension-arm toggle, centered pull, and mutes.
- `foldEvents` already accepts a `compost` event and skips unknown types. The bench does not emit them.

The engine is `lib/song-garden-lab/`. `npx tsx lib/song-garden-lab/lab.test.ts` checks quantization, replay, resistance, the arm law, path-dependent tension, and compost. `npx tsx lib/song-garden-lab/analyze.test.ts` checks the voice measurement.

### Experiment B, as built

Voice is a mode on the same lab. It does not replace the grammar bench.

- Record up to eight seconds, import a file, or analyze a built-in test tone. The tone exists so the mapping can be checked with no microphone.
- The take is resampled to 16 kHz. Raw, normalized, and quantized values sit beside the body. Bounds are fixed, and a session never refits them.
- The quantized genome is what is stored. Re-analyzing the same audio matches those bytes. Drop audio leaves the organism.
- The left body is the official reading: zero birth, coupling 0. The right body is the same genome at the lab’s current birth and coupling.
- Character prompts label the take. They do not name the six axes.
- A session plot marks each axis. An axis that barely moves across two or more takes is marked as a dead wire.
- The session restores from local storage. The audio does not.

### Experiment C, as built

**A/B** on the same lab folds the published twelve twice. World A is order `1..12`. World B is `8, 2, 11, 1, 5, 12, 3, 7, 9, 4, 6, 10`. A four-genome order is there for debugging the fold. It is not the proof.

- Both grounds are on screen. A, B, and the pair view isolate one world or the selected body. Keys `1`–`5` are the official coupling sweep `0, 0.25, 0.5, 0.75, 1`, with the arm law off and leak at 0. `L` hides labels. A dot at the root is the highlight, so the name is not required to see which body is selected.
- Contribution `h04` is selected by default. It is plant 4 in A and plant 10 in B.
- The panel shows birth tension for that body in each world, overlaid condition trajectories, and a channel-distance table against the typical distance between different genomes in A. Those numbers are marked as measurements.
- Density only, tension only, and a boundary pass that allows tension to add an arm are one click.
- Notes stay in local storage.

Placement now hears density through coupling. At coupling 0 the ground is the empty-garden arrangement, plus a separation nudge where two preferred spots overlap. The shapes match. The condition log still diverges, and tension is the final that carries the path on this set.

`npx tsx lib/song-garden-lab/compare.test.ts` checks the published permutation, matching shapes at coupling 0, path-dependent tension, and a different bend for `h04` at full coupling.

### Regeneration, as built

Field history is an event log. **Return to the ground** appends a `compost` event for the selected living body.

- The return is `compostFraction` (default one half) of that body's own deposit. The fold adds it with the same diminishing update as a planting. The body leaves the living set. The planting event stays.
- A faint, still remnant can be drawn at the old root. It is a view of the returned id, not a second organism. The ground slot stays taken.
- Scrubbing the moment replays a prefix of the log, so a return can sit before a later planting and change that birth. The field list shows that birth tension. Coupling is what lets the tension bend the ribbon; at 0 the gesture stays and only the ground number moves.
- Leak, default 0, thins all three conditions after every event. **Let time pass** appends a `tick` each second, and that second is an event. The living bodies stay. The next birth hears the thinner ground. At leak 0 a second changes nothing.

`npx tsx lib/song-garden-lab/compost.test.ts` checks that a return is not a refund, that the planting remains, and that returning before the next body changes that body's birth.

### Sound, as built

**Sound** plays the fold that is on screen. Density, after the ceiling, is how thick the air is. Pulse is the tempo of that air. Tension is how far each body's stored register sits from C4. Register 0.5, which is every published genome and every unpitched take, stays on C4, so those bodies share one pitch. A sung register spreads toward C2 and C6 only as tension rises. Turning tension off in the mutes pulls every voice back to the center.

The canvas is not an input. `npx tsx lib/song-garden-lab/sound.test.ts` checks the pitch span, the ceiling, a muted tension, and that a tick thins the ground without removing a body.

### Pictures and words, as built

**Seen** measures a still or a clip into the same six axes. The picture is downsampled to a fixed grid. A still reports source `still`: motion and articulation stay empty, and a contrasted frame is a held gesture. A clip can report `flow` from frame-to-frame change. Register stays at the center. Dropping the picture leaves the body. The fixtures Flat, Checker, and Blink check the mapping with no camera.

**Words** sends one short phrase to a model and asks for three numbers, each with a confidence: hold, outward, and weight. A confidence under 0.5 is ignored. The numbers are not a genome, not a picture, and not a deposit. The ribbon still comes from the measurement. With no model key, the phrase is kept and every confidence stays 0.

`npx tsx lib/song-garden-lab/vision.test.ts` checks the still, the blink, a repeated picture, and that an out-of-range model reply is clamped and gated.

---

## 1. Garden conditions

A condition is a slow number that previous events have pushed, that later germination can read, and that a person can eventually feel. If a number does none of those, it is not in the vector.

The brief listed energy, density, openness, resonance, harmonic tension, rhythmic activity, growth pressure, interconnection, luminosity, and movement. Several of those are the same work under two names.

| Candidate | Verdict |
| --- | --- |
| Energy | Loudness already lives on the genome. A shared “energy” copies it into the sky. |
| Openness | The inverse of crowding, unless silence does something crowding does not. It does not, yet. |
| Luminosity | Brightness already lives on the genome as stroke fineness. A shared light meter is easy to see and hard to justify as history. |
| Movement and rhythmic activity | One job: how activated the garden is. Keep one. |
| Resonance and interconnection | Readouts of who is near whom. Storing them as globals makes every relationship the same. Compute them later from positions. Do not store them now. |
| Growth pressure | A derived push on the next body. It can be computed from density if we need it. |
| Density | Real. How occupied the ground has become. |
| Harmonic tension | Real, if it means instability left by previous gestures, not a mood. |
| Rhythmic activity | Real, if it means how much articulation has accumulated. |

**Initial condition vector**

```
conditions = {
  density,  // 0..1  how occupied the ground is
  pulse,    // 0..1  how much articulation has accumulated
  tension   // 0..1  how much instability has accumulated
}
```

Three is the smallest set that can make two histories differ in *kind*, not only in amount. Density changes spacing and size. Pulse changes the motion signature. Tension changes bend. One variable would still make order matter, and the worlds would feel like the same garden turned up. The lab should be able to mute any of the three to zero. If a session cannot feel one of them, it leaves the vector. Four was considered, with luminosity as the fourth. It was cut because the genome already carries brightness onto the stroke. Collective brightness, later, can be the mean of living genomes. That is a readout, not a state.

Origin is **zero**, not a designed mild weather. The first organism meets an unwritten garden and expresses its genome alone. That requirement binds the grammar: a body born at zero must already look like it belongs to Song Garden.

Deposits, saturation, leak, and effects are specified in §8. Local conditions are not in A–C. The fold function takes a condition vector, so a later blend of global and local can be passed in without changing germination.

---

## 2. Structural identity and living behavior

An organism has two layers.

**Structure** is fixed at germination. It is a pure function of genome, birth conditions, and the rules version in force for that event.

- Branching topology. In the first grammar this is: one rooted body, and either no secondary arm or one. The choice is genomic. Conditions do not add or remove it.
- Proportions and the characteristic curve.
- Stroke weight and fineness.
- The intrinsic motion signature: period, phase, and the shape of the sway. These are parameters, not a frame of animation.

**Behavior** is evaluated at draw time. It is not written back into the log as the body.

- How far the current sway swings.
- A bias in orientation.
- Luminosity breathing.
- A tip opening or closing.
- Whether it is sonically active.
- Secondary growth laid on top of the frozen topology, never instead of it.
- A lean toward or away from a neighbor.

A–C draws structure plus the intrinsic sway at a fixed amplitude, so the field is not a still life. Every other behavior returns a neutral value. The function exists:

```
behavior = live(structure, currentConditions, neighbors, time)
```

`neighbors` may be empty. `currentConditions` may be ignored. Later work fills the function in. Secondary growth, when it exists, is stored as marks with the log index that grew them, so the birth topology can still be seen underneath.

The failure this split prevents: a later condition redraws history, and contribution #4 in World B is no longer the gesture from World A. The failure it must not create: a garden of corpses. Sway from the intrinsic signature is the minimum sign of life. Relationship and secondary growth stay available and unbuilt.

There is an experimental law, default off, that allows birth tension to change branch count. It exists so the identity boundary can be found. It is not the default law. If it is the only way World A and World B look different, the grammar’s geometric range is too small, and the grammar should change before the topology is given to the collective.

---

## 3. Felt causality

A decoded mapping teaches the trick. High pitch becomes height, and the garden becomes a meter. Felt causality is the maker’s sense that the body came from the gesture they just made, without a one-line rule.

The interaction that supports that:

- No structural channel is a single acoustic axis. Size comes from force and sustain together. Bend comes from motion, pushed by birth tension. A secondary arm appears only when articulation and motion are both high. Fineness comes from brightness, and a very forceful gesture thickens the stroke enough to partially hide that fineness.
- Extremes compress. A shout is not a whisper scaled up. Past a knee, more force changes weight and resistance more than it changes length.
- Unpitched gestures still have motion, through spectral flux, so a clap is not assigned a random pitch that moves the body for no reason the ear can share.
- Register is captured and stored. It does not receive its own structural axis. The tall plant for the high note is the mapping this pass refuses. Register is kept because a later sound interpreter needs it, and because the lab should show it. If makers consistently feel pitch is missing, the lab can add a bounded, nonlinear influence. That is an experiment, not a starting rule.

**How to test**

1. **Maker recognition.** Each person records three gestures that feel different to them. They are shown three bodies, unlabeled, and asked which is which. Chance is one in three. Afterward they are asked what gave it away. Matching well *and* answering with a single axis (“the high one is the tall one”) is a failed mapping. Matching well and answering with character (“the hesitant one curls,” “the steady one is the simple line”) is success.
2. **Decodability audit.** A stranger who did not record is asked to rank the same bodies by loudness, by pitch, and by length. High accuracy on any one ranking means that axis is too literal. We want maker recognition above the decodability scores.
3. **Pair holds.** Two takes with similar force and different motion should differ. Two takes with similar motion and different force should differ and still feel related. If either pair collapses, the genome is smaller than it looks.
4. **Linear control.** The lab can switch to a one-to-one preset (force to scale, centroid to fineness, onsets to marks, pitch to height). That preset is a foil. If makers prefer it, the nonlinear model is decoration and should be cut. The foil exists so we can lose.

The stranger-match test remains available as instrumentation. It is not the gate.

---

## 4. The laboratory

The lab is how the laws get discovered. It is a single local surface. No accounts, no production route, no model, no sync. The log lives in memory. A reload may restore it from local storage so a session can continue. Replay does not depend on storage.

**Layout**

- A viewport. One world, or World A and World B.
- A genome inspector.
- A conditions inspector.
- A grammar and laws inspector.
- A history strip.

**Genome panel**

- The six structural values and the latent measurements, as raw, normalized, and quantized.
- Sliders that write a synthetic genome without a microphone.
- The derived values: resistance, whether a secondary arm is present, which source supplied motion (pitch span or spectral flux).
- The normalization constants. They are absolute. They are never fit to the current session.

**Conditions panel**

- The vector at the selected log index, and the birth vector of the selected organism.
- The deposit of the selected event, broken out by variable.
- Sliders for saturation gain, per-variable leak, coupling, per-channel modulation limits, resistance strength, and the branch-count toggle.
- A mute per condition.
- The trajectory of the three variables across the log, for the world in view.

**Grammar panel**

- Growth parameters the renderer actually reads: length, width, taper, curvature scale, arm length, mark size.
- Visual constraints: ground color, stroke color, alpha range, maximum stroke width. Palette edits are deliberate. They are not a second theme system.
- Motion: sway amplitude, and whether idle sway is on.
- A determinism control. It runs `express` twice on the selected organism and compares a hash of the control points. A mismatch is a bug, not a variety.

**History panel**

- The ordered log. Select, drag to reorder, delete, duplicate, insert a synthetic event at an index.
- Replay from the start. Reset to empty.
- Scrub the index and watch germination freeze at that prefix of the log.
- Compare mode, below.

Changing a law slider recomputes a **draft**. The draft is labeled as hypothetical. It does not rewrite stored events. Committing a new rules version is a season boundary, specified in §11, and is not required to use the lab. During A–C every run is a draft under one version, and the functions still take the version so a later season is not a rewrite of the call.

---

## 5. World A / World B

Compare mode is the instrument for the central tension.

Input: twelve genomes, identical across worlds. World A plays them in order `1..12`. World B plays a fixed interleaved permutation:

`8, 2, 11, 1, 5, 12, 3, 7, 9, 4, 6, 10`

Reverse order is available and is too weak to be the proof. It often looks like one gradient, flipped. The interleaved order is the published test. The lab can also accept a custom permutation. The published one is what we compare across sessions.

The viewport shows both worlds, or switches with the keyboard, and highlights one genome id in both. Contribution #4 is selected by default in screenshots and notes so the identity question has a stable subject.

Coupling, limits, and mutes rebuild both worlds from the same genomes immediately.

**The two questions, scored separately**

History is visible if a person who did not watch the replay can tell the worlds apart, and can say something about the difference that matches a real divergence (who is crowded, who is bent, which ground feels more activated). A difference that only a chart shows is a failed proof.

Identity survives if that person, shown genome #4 alone in each world, recognizes them as the same gesture under different pressures. A harder form: highlighted in the field, they can find its partner.

**The useful region**

Too little coupling: the worlds are a gallery of matching stickers. Too much: #4 cannot be found, because the birth conditions replaced the gesture.

Instrumentation, not the verdict: for each genome, distance between its two expressions, against distance to other genomes in the same world. The region worth keeping is where same-genome cross-world distance stays below typical different-genome distance in one world, and people still tell the worlds apart. If the distances say identity survived and people cannot find #4, the channels that moved are not visible. That is a grammar failure, not a reason to raise coupling.

A short form, four genomes, exists for debugging the fold. The proof uses twelve.

---

## 6. Experiments A–C

Global exclusions for all three: no public route, no AI, no Runway, no image generation, no audio output, no compost, no neighbor forces, no accounts, no sync, no edits to `WorldJourney` or `WorldState`.

### A — Grammar bench

**Hypothesis.** One drawing grammar, driven by the six-axis genome and the three conditions, can produce bodies that are one family, are not copies, and read as a shared ground rather than a set of logos. A body born at zero conditions already belongs to that family.

**Minimum functionality.** The lab viewport, synthetic genomes, the laws panel, determinism hash, and a field of up to twelve. No microphone.

**Inputs.** A fixed set of thirty genomes from a Halton sequence in the six axes, plus live sliders. Condition presets: all zero, and a few hand-set vectors. The twelve-genome published set used later by C, drawn at zero coupling so the grammar is seen alone.

**Outputs.** A canvas of rooted ribbons. A hash of control points per organism. Frame time on a phone-class laptop profile.

**Adjustable parameters.** Every grammar and law slider. Coupling may be previewed. The official A reading is taken at coupling 0 and at one mid coupling, so we see the grammar before the collective is asked to save it.

**Instrumentation.** The thirty-genome contact sheet. A field of twelve. The determinism hash. A frame-time readout.

**Evaluation.** Three people who know the product, looking at the contact sheet and the field, answer: one family or many sketches; can you tell these apart; does the field feel like one place; does the zero-condition body already look like Song Garden. Plus the hash, plus frame time.

**Success.** The sheet is one family and visibly varied. The field of twelve reads as one ground. Zero-condition bodies are acceptable, not a special-case illustration. Replay hash matches. Drawing stays smooth with twelve bodies.

**Failure.** One shape. Unrelated sketches. Twelve logos on a black page. The zero-condition body only looks right after conditions are faked upward. The hash flips. The phone profile stutters on twelve.

**What we learn.** Whether there is a visual language worth mapping sound onto. If the field reads as logos, the next change is the ground and the stroke, not an L-system.

**Not built in A.** World A/B as the official test, sounded output, behavior beyond idle sway. Voice analysis is Experiment B.

### B — Voice → genome

**Hypothesis.** The six-axis genome, analyzed once at capture, gives makers felt causality without giving strangers a single-axis decoder.

**Minimum functionality.** Record up to eight seconds. Resample to 16 kHz. Compute raw, normalized, and quantized values. Show them beside the resulting body in the lab. Store the quantized genome. Replay the body from the genome with no audio present.

**Inputs.** Gestures prompted by character, not by our axes: hold a tone, whisper, clap a rhythm, slide the pitch, leave a long silence in the middle, shout, hum a short leap. At least three people, about six takes each. The same take imported twice.

**Outputs.** A portable genome. A body at zero conditions, and a body at the current lab conditions. The raw measurements for inspection.

**Adjustable parameters.** Normalization bounds. Quantization step (default 64). The knee on force. The threshold that chooses pitch-span versus spectral flux. The linear-control foil switch.

**Instrumentation.** Genome bytes. Maker-recognition score. The words they use. Decodability rankings. The duplicate-import byte check. A plot of the six axes for the session, to see which axes never move. An axis that never moves is not expressive range. It is a dead wire.

**Evaluation.** The protocol in §3. Run it at coupling 0 first, so the collective does not get credit for the gesture.

**Success.** Maker match above chance. Their explanations are about character, not one acoustic slider. Strangers rank a single axis poorly relative to that. The same take yields the same bytes. At least five of the six axes actually vary across the prompted gestures. If `motion` never leaves zero, the pitch gate is wrong.

**Failure.** Makers match by naming one axis. Makers cannot match and strangers cannot either (the body is unrelated). Duplicate imports differ. Most axes sit in a clump. The linear foil wins the preference and the nonlinear cross-terms should be removed rather than tuned forever.

**What we learn.** Whether this genome is worth depositing into a shared history. Which latent pitch values are stable enough to keep for later sound.

**Not built.** Condition deposits as the subject of the test, the drone, semantic interpretation, the public recorder.

### C — The log remembers

**Hypothesis.** Two orders of the same twelve genomes produce worlds a person can tell apart, while a highlighted genome remains recognizable across them, inside some middle range of coupling.

**Minimum functionality.** Compare mode. The published permutation. A coupling sweep. Selection linked across worlds. Fold from an empty origin. Synthetic genomes are enough. Genomes from B are better when they exist, and they are not a gate.

**Inputs.** The published twelve. Orders A and B. Coupling at 0, 0.25, 0.5, 0.75, and 1. Branch-count toggle off for the official sweep, and one extra pass at 0.5 with it on, recorded as a boundary probe.

**Outputs.** Two worlds per coupling. Condition trajectories. Same-genome distances. Notes from the viewers.

**Adjustable parameters.** Coupling, per-channel limits, resistance, leaks (official sweep uses leak 0), condition mutes, the branch toggle.

**Instrumentation.** Trajectories overlaid for A and B. A distance table. A short viewer script: “Are these the same community?” and “Find this one in the other world.”

**Evaluation.** At least five viewers who have not watched the fold. Identity and history are scored separately, at each coupling. The useful region is wherever both scores are acceptable. Zero coupling must fail the history question. Full coupling is allowed to fail identity. If no coupling passes both, the modulation limits or the grammar’s visible channels are wrong. Do not declare the idea dead until the extra branch-toggle pass has been seen and set aside, and until one mute-combination (density only, tension only) has been looked at. Sometimes one channel is doing all the visible work and the other two are mud.

**Success.** A nonempty band of coupling where viewers tell the worlds apart and find #4. At coupling 0 they do not reliably tell the worlds apart. The final condition vectors are not identical (the diminishing deposit is path-dependent). The birth vector of #4 differs across worlds.

**Failure.** No coupling is readable as both history and identity. The worlds differ only in the trajectory chart. Coupling 0 already looks like different worlds (the drawing is unstable). The same genome’s topology changes with the toggle off (a bug in `express`). Viewers find #4 only because a label is printed on it. Labels used in debugging must be hideable for the evaluation.

**What we learn.** Whether a history can be visible at a coupling that leaves a person intact. Which condition is pulling its weight. Whether the proof can be felt.

**Not built.** A second device, presence-without-content as a product, audio, leak across real time, compost, any production opt-in.

---

## 7. Initial genome

The portable record is computed once, on the capturing device, after resampling to 16 kHz. Other devices replay the record. They do not re-analyze audio.

Pipeline for every axis: **raw measurement → normalize with fixed bounds → quantize to 64 steps.** Session min/max normalization is forbidden. It would make the same gesture a different genome in a different room.

Quantized value = `round(clamp(normalized, 0, 1) * 63) / 63`.

Analysis constants, part of the rules version: 16 kHz, frame 1024, hop 256, capture window T = 8 s. Pitch search from 80 Hz to 800 Hz. Confidence comes from the periodicity of the estimator. The exact estimator can be autocorrelation. It is part of the version. Changing it is a new version, not a quiet fix.

**Structural axes**

| Axis | Raw | Normalization | Why it earns a place |
| --- | --- | --- | --- |
| `force` | RMS of the take | −50 dBFS .. −8 dBFS, through a log curve | A whisper and a shout are different gestures. Without weight, the body has no mass. |
| `sustain` | Longest contiguous span above −40 dBFS, divided by T | Already 0..1 | A blip and a held phrase differ. This is length of the gesture, not average loudness. |
| `stillness` | Fraction of frames below −45 dBFS | Already 0..1 | Space inside the take. It is not `1 - sustain`. Eight short claps and one short tone can share a sustain and differ here. |
| `brightness` | Mean spectral centroid while sounding | 200 Hz .. 4000 Hz, log | Tone color. A bright whisper and a dark hum can share a force. |
| `articulation` | Onsets per second while the window is open | 0 .. 8 /s, soft-clipped | Rhythm against smoothness. This is what later deposits into pulse. |
| `motion` | If pitch confidence ≥ 0.45, pitch range in semitones. Otherwise mean spectral flux of sounding frames. | 0 .. 24 semitones, or a fixed flux bound set in the version | Monotone versus leap, and a clap still has motion. One axis, two sources, so unpitched sound is not given a fake melody. |

**Latent measurements, stored, not structural**

| Field | Role |
| --- | --- |
| `pitchConfidence` | Makes the motion source deterministic on replay. |
| `register` | Median pitch, log-normalized from C2 to C6. `0.5` when confidence is below the gate. Kept for a future sound interpreter. No structural channel. |
| `motionSource` | `pitch` or `flux`, so the lab can see which path fired. |

Force and sustain also derive **resistance** at expression time: `0.15 + 0.85 * force * sustain`. A loud held gesture is harder for the garden to push around. A quiet fragment is more shaped by where it landed. Resistance is not a seventh axis. It is the genome’s stubbornness, and it is how a tendency survives an environment.

If the axis plot in B shows `stillness` and `sustain` moving as twins on real takes, drop stillness before adding anything new. The smallest genome is the one this table becomes after dead wires are removed, not the one that lists every measurable.

---

## 8. Initial condition vector

Deposits use the quantized structural genome. Gain `g` defaults to `0.08` and is a law.

Because the update is `c ← c + deposit * (1 - c)`, a large deposit applied early occupies more of the remaining headroom than the same deposit applied late. The final vector depends on order. Birth snapshots depend on order even more.

Leak is `c ← c * (1 - leak)` after each event. Official C runs use `leak = 0`. The parameter exists so regeneration and long time can fade a condition later without a new architecture.

| Variable | What deposits | Saturation | Leak in A–C | Effect on the next organism | Visible as | Sound, as built |
| --- | --- | --- | --- | --- | --- | --- |
| `density` | `g * (0.35 + 0.65 * sustain * (1 - stillness)) * (0.5 + 0.5 * force)` | Diminishing, as above | 0 | Pushes scale down and spacing tighter, within the channel limit | Bodies sit closer and slightly smaller. The ground itself does not fog over. | How thick the air is allowed to get |
| `pulse` | `g * articulation` | Diminishing | 0 | Pushes the frozen motion period shorter, within limit | Germination and idle sway carry the period baked at birth | The tempo of a drone |
| `tension` | `g * motion * (1 + 0.5 * pulse)` | Diminishing. The `pulse` factor makes this deposit path-dependent in a second way | 0 | Pushes curvature up, within limit. Does not change branch count unless the experimental toggle is on | Bend and asymmetry of a topology the genome already chose | How far a residue sits from the center of the scale |

Nothing deposits into a variable that does not change a later body. Pulse is allowed to change a frozen motion parameter rather than live animation so that a body keeps the activation of the garden that received it. Live amplitude, later, can still answer the current pulse without rewriting that signature.

Spacing is placement at birth: a hashed base position, then a minimum separation that shrinks as birth density rises. The resolved position is written on the event so a replay does not need to rediscover it by simulation.

---

## 9. How genome and conditions interact

The organism is not the sum of a genome and a condition vector.

Development has four steps.

**1. Tendencies, from the genome alone.** These are the body’s proposals: scale, curvature, asymmetry, stroke fineness, motion period, and the boolean secondary arm. The arm is a threshold on `articulation * motion`, genomic only.

**2. Resistance, from the genome.** `effectiveCoupling = coupling * (1 - resistance)`. Quiet fragments listen to the garden. Held force resists it.

**3. Bounded push, from birth conditions.** Conditions start at zero, and zero push means zero change. The first body is the pure tendency.

```
delta = tanh(2.2 * condition)
expressed = clamp(tendency + effectiveCoupling * limit * delta, floor, ceiling)
```

Each condition is allowed to push only the channels assigned to it.

| Condition | May push | May not push |
| --- | --- | --- |
| density | scale, spacing | topology, fineness, period |
| pulse | motion period | curvature, topology |
| tension | curvature, asymmetry | scale, topology, branch count |

Limits are laws. Starting points, at coupling 1 and zero resistance: scale ±12 percent, period ±20 percent, curvature up to about ±35 percent of the remaining headroom. These are wide enough to see and narrow enough that a body is not replaced. The lab can open them. Opening them until identity dies is part of C, not a bug.

The push is one-directional: density crowds, it does not enlarge; tension bends further, it does not straighten a curly genome back to a stick. A genome that is already bent stays bent in a calm garden. That is the tendency surviving. A centered pull, where low conditions drag bodies back toward a neutral ideal, is a lab toggle defaulting off. It was rejected as the starting law because it makes the empty garden a designed average.

**4. Realize.** The grammar turns expressed numbers into control points. Topology is decided before this step. Realize does not get to grow an extra arm because the garden is tense.

There is no local field in A–C. `express(genome, birthConditions, laws)` does not know why the vector has the values it has. A later local sample can be blended into the vector before the call. Germination does not change.

Thresholds are not in the default laws. They are easy to add and hard to feel. The branch toggle is the one threshold under test, and it is off.

---

## 10. Grammar candidates

All three are 2D, deterministic, and drawable as a growing stroke on one canvas. None of them is a species library.

### Rooted ribbon

Every organism has a root, one variable-width stroke, a tip, and at most one secondary stroke. The spine is a short polyline whose curvature is integrated from the expressed curvature, so the bend is a continuous decision rather than a stack of random wiggles. Width comes from force, taper and fineness from brightness and sustain. The secondary arm, if the genome earned it, leaves the spine partway up and is shorter.

Range is moderate. The family is tight. Controllability is high. Determinism is a hash of the points. A phone can draw far more than twelve. Germination is the stroke drawing up from the root, which is the witness. Genome and conditions map cleanly onto length, width, bend, and period. Later relationships can turn the whole ribbon’s rest angle without editing the intrinsic curve.

The risk is that twelve ribbons look like twelve signatures, a logo sheet. The shared ground has to do real visual work: one soil line, a common darkness, the accent color only.

### Stem and marks

A single stem, the same integrated curve, with marks placed along it by a fixed angular step. Count of marks from articulation, size from force. A small tip figure from brightness. This is the ribbon plus a phyllotaxis of marks.

Range is a bit wider. It reads more quickly as a plant, which is both the attraction and the risk: a textbook sprout. Controllability stays high if mark shapes stay abstract, notches or seeds, not leaf drawings. Performance and determinism match the ribbon. Germination can grow the stem and then the marks. Neighbors can still reorient the stem later. Interlocking marks between two organisms is a trap and should not be a goal.

### Deterministic bracket grammar

A tiny rewrite system, depth capped at four, angles and lengths taken from the genome, no random productions. This buys real branching topologies.

Range is the widest and the least controllable. It is the most likely to look like a generative-art plant demo, which this project does not need. Determinism is fine if the rewrite is fixed. Performance is fine at a capped depth. Germination by generation is legible. Relationships between two rewrite systems, stems weaving, is a research project of its own. Conditions can scale lengths and angles. They should not change the production rules if identity matters. At that point the extra topology is mostly unused.

**Recommendation.** Start with the rooted ribbon, on the existing world palette: near-black ground, accent `#CFFF81`, no second hue system. If a field of twelve reads as logos, add the stem-and-marks placement on the same spine before considering the bracket grammar. The bracket grammar is the candidate we already know how to overbuild.

Germination, about two seconds, from the root upward, is part of A, not a polish pass. A body that pops in has already lost the witness.

---

## 11. The log is the world

The renderer is a view. The fold of the log is the world.

```
type Event = {
  id: string
  index: number
  type: string
  rulesVersion: string
  at: string
  payload: unknown
}
```

A–C writes one type, `contribution.planted`:

```
payload = {
  genome,            // structural + latent, quantized
  birthConditions,   // the vector before this deposit
  deposit,           // what this event added
  position,          // resolved at birth
}
```

`birthConditions` is stored so a client can draw one organism without replaying the universe, and so the lab can show it. The fold must still be able to recompute it. If they disagree, the fold wins and the stored snapshot is stale. That check belongs in the lab.

**Reserved types, not implemented**

| Type | Later meaning |
| --- | --- |
| `bloom` | A composed shock to conditions. A season changes inside the laws. |
| `gathering` | Some organisms are marked as taken into a song. They remain in history. |
| `compost` | A body returns material to conditions and leaves the living set. |
| `song.created` | The song exists. Payload can point at it. |
| `song.returned` | The song comes back into the garden as an event, not as a new picture format. |
| `season.transition` | The rules version that applies to subsequent events. |
| `intervention` | An artist’s explicit deposit or placement, stamped as such. |

The reducer is a fold over events, dispatching on `type`. Unknown types are skipped and listed in the lab. They are not crashes, and they are not silent. That is enough room for the later types. An append-only array of organisms that nothing can amend would block compost. The living set at index T is: planted at or before T, and not composted at or before T.

**Rules versions**

Each event is stamped with the version that governed its expression. Replay uses that stamp. Editing the grammar does not reinterpret history unless the lab is in draft compare, which is labeled hypothetical and is not written back.

A `season.transition` is how a garden adopts a new version from one index forward. Organisms born before the boundary keep their stamp. The draft slider in the lab is the hypothetical. It is not a migration.

During A–C there is a single version. The stamp is still written, so the first real change does not require a migration of old calls.

Media bytes are not the log. A recording can sit beside an event id for the maker test. Replay of structure does not need it.

---

## 12. Regeneration

Compost is a future event, not a visual of something fading off.

```
{ type: "compost", payload: { organismId, returns: { density, pulse, tension } } }
```

The fold, at that index, stops drawing the body as living and applies `returns` through the same diminishing update as a deposit. Returns are a fraction of what that organism originally deposited, not a full refund and not a new currency. Some of the gesture stays in the garden as conditions. Some is gone. The original `contribution.planted` event remains. History is not deleted.

A remnant, if one is ever drawn, is behavior or a view of a composted id. It is not a second organism.

This works only because the world is a fold. A–C does not emit `compost`. It also does not store the living set as an append-only document that later code cannot amend.

A slow leak on the three conditions is the other half of regeneration: what nobody renews eventually thins. Leak still defaults to 0. **Let time pass** appends one `tick` per second, and each tick applies the leak. The living set does not change.

---

## 13. Audio, from the same fold

`sounding(organisms, conditions, laws)` reads the folded state. Density supplies thickness, up to `densityCeiling`. Pulse supplies tempo. Tension supplies distance from `scaleCenterMidi`, across `scaleSpanSemitones`. Latent `register` on each living genome supplies the direction. The ribbon is not an input. There is no second simulation.

Register stays off the structural axes. `express` still ignores it. Dropping it would force a later re-analysis and break the rule that other devices replay the genome.

The scale center, the span, and the density ceiling are laws, parallel to the drawing laws. They are not a backing track. The published twelve sit at register 0.5, so they share the center pitch. That is the set, not a missing oscillator.

---

## 14. AI

Signal processing and the grammar are still the picture. There is no image generation and no Runway.

A model is used only for words, and only to return three latent numbers with confidences. They are held, not deposited. Low confidence means that number is ignored. No model, or a failed call, means every confidence is 0 and the planting germinates from the measured genome.

---

## Production boundary

The lab, when it is built, does not replace `WorldJourney`. The current storyboard, the dot field, and `WorldState` energy remain the public product until a coupling band has actually been felt by viewers in Experiment C. An opt-in garden comes after that, and is not designed here.

---

## Unresolved on purpose

These are not details left out of a finished design. They are the questions A–C exist to answer.

- Whether three conditions are two too many, and which mute still leaves history visible.
- Whether the rooted ribbon can be a place, or only a set of signatures.
- Whether felt causality survives contact with real phone microphones and the fixed normalization bounds.
- Whether any coupling band satisfies both viewers’ questions at once.
- Whether one-directional push is too monotonous, and the centered-pull toggle produces a more visible history without a designed destination.
- Whether keeping topology genomic makes order too subtle, and the grammar must show bend more clearly before topology is allowed to change.
- Whether `stillness` is independent of `sustain` on real gestures.
- How strong resistance should be before quiet gestures feel like they belong only to the crowd.
