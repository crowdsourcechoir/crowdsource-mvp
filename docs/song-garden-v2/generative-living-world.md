# Song Garden — generative living world

Status: **strategy** (no build)
Replaces, as the next question: [`felt-garden-plan.md`](./felt-garden-plan.md)
Related: [`architecture.md`](./architecture.md), [`persistent-world-spec.md`](./persistent-world-spec.md)

The question is not how to add generative plants to Song Garden.

The question is what rules let a community grow a digital world that none of us, including its designers, completely knows in advance.

---

## What the product is today

Song Garden V2 is a short guided visit on top of a designed picture.

The public visit is `WorldJourney` on `/e/[slug]`. A persistent `WorldStage` sits behind a card. The stage crossfades authored storyboard plates (still or Runway video) from dormant toward full bloom as energy rises. On top of that, Framer Motion draws a few dozen particles, a glow, and one DOM dot per contribution, placed on a sunflower spiral. A one-second sparkle marks a successful submit. Other people appear as a line of text.

Shared persistence, where a garden is linked, is `WorldState`: one energy number, a layer intensity per contribution kind, a capped list of nodes, and landmarks that unlock when a threshold is crossed. `applyMutation` adds a fixed increment. The same hundred contributions in a different order produce the same energy, the same layers, and the same landmarks. Order is not a force. The picture at the end is chosen in advance.

Audio capture exists (`quick-record.ts`). The analyser is used for a loudness meter. Nothing about pitch, brightness, rhythm, or silence is kept. There is no WebGL, no botanical grammar, no synthesis engine. The stack is Next.js 14, React 18, and Framer Motion. `openai` and a Runway client are already in the repo for other jobs. Runway is how the current world gets its bloom plates. That pipeline makes pictures of gardens. It is the opposite of this brief.

The production visit should stay where it is while this is learned. Do not rebuild `WorldJourney` in order to run the experiments below.

---

## Recommendation, in one page

Build a **climate with germination**, and keep it in a lab until it earns a way into the product.

Each contribution is a force appended to an ordered log.

- The force carries a **genome**: a small set of numbers measured from the gesture.
- At the moment it arrives, it **germinates**. The organism’s body is fixed by the genome and by the climate at that instant, then frozen. A tree remembers the wind it grew in. Later weather does not redraw it.
- The force also **deposits** a residue into the climate: a slight change in wind, moisture, pulse, harmonic dust, density. The deposit saturates and decays, so the first voice matters and does not own the sky forever.
- The next person germinates inside whatever climate the log has become.

We author the grammar and the laws of the climate. We do not author the garden. Two communities, or the same community in a different order, grow different worlds. The same gesture, replayed against the same climate and the same rules version, grows the same organism.

The organism is drawn with a **2D parametric grammar** on one canvas. Stems, curvature, branching, bloom. One palette, one stroke family, the existing dark ground and lime light. Not a library of flowers. Not a shader soup with nowhere to point. Not a Three.js forest.

Before someone contributes, they see climate and silhouettes. Movement, pulse, light, new growth occurring. They do not receive the phrase, the melody, or the raw recording. After they contribute, perception deepens: their organism is sharp, nearby traces gain detail. That depth is a way of seeing the same log. Raw media still stays on the server until this device has a contribution, so the network tab cannot skip the seal.

The 10–20 second visit is: arrive in a moving climate, give one short sound, watch it germinate. Leaving then is a complete participation. Staying, listening, and returning are how the same log gets deeper. A finished song, later, is not a new scene. It is another event in the log: a season.

AI does not draw, and it does not sit on the path of that first visit. Acoustics are enough to germinate a voice. A model becomes useful only when the contribution is language and the sound alone would miss the meaning. Even then it returns a few numbers. The grammar still decides the form.

The first thing to prove is not the microphone. It is the grammar. If eight numbers cannot draw thirty related, distinct organisms, no audio pipeline will save it. The thing that proves the actual idea is the next test: the same gestures, two orders, two climates, and a person who can still find the organism that is theirs.

---

## 1. Conceptual model

The computational metaphor is a **dynamical climate plus a birth-locked organism**.

A procedural garden is the right *picture*. It is the wrong *engine* if “procedural garden” means an L-system that tries to look like botany, or a bar that fills from empty to bloom. Botany is a drawing grammar. The world is a short list of slow variables with memory.

Why this and not the other famous systems:

| System | What it is good for here | Why it is not the whole world |
| --- | --- | --- |
| Parametric / L-system grammar | A family of organisms from a handful of numbers. Artistic control lives in the rules. | A classic plant L-system looks like a textbook, and it has no memory of other people. |
| Particles | Wind, mist, pulse, the feeling that the air is occupied. | A particle is hard to claim as “mine.” |
| Agents | Neighbors, clustering, a body that keeps a pitch. | Hundreds of simulated bodies will melt a phone and still look like a toy if the grammar is weak. |
| Reaction-diffusion, cellular automata | Real emergence, strong path dependence. | Personal authorship disappears into a texture. |
| Shaders | Atmosphere, light, cheap beauty on a phone. | A fullscreen shader has no individual to witness. |
| Physics (wind on a tree) | The metaphor in the brief, taken literally. | A real structural simulation is expensive, brittle, and easy to make ugly. The metaphor does not require the physics. |
| Graph | Relationships among organisms, later. | A graph with nothing to see is a database. |

The hybrid is small on purpose.

- **Climate.** About eight slow numbers, plus a few spatial regions only after a single global climate has been shown to matter. Wind, moisture, pulse, harmonic residue, brightness tendency, density, tension, season. Each has a ceiling and a leak, so the system can approach a character without arriving at a designed final frame.
- **Organism.** A genome of about eight numbers. A pure function draws it: `phenotype = grammar(genome, climateAtBirth, rulesVersion)`. The drawing is curves. Branching can be L-system-like. The species is the grammar, and there is one species.
- **Deposit.** Germination also writes a small delta into the climate. The next germination reads the new climate.
- **Picture.** One canvas. Climate in the ground and the air. Organisms on top. A bounded number stay fully drawn. Older ones compact into climate, the way the current node list already compacts, except the compacted mass has to change the air, not vanish into a counter.

That is enough for a contribution to create a body and to change the conditions of every body that follows. It is not enough to run an ecosystem simulation, and it should not try.

---

## 2. Emergence, control, determinism, persistence

Genuine emergence here means: the designers can state the laws, and still cannot draw tomorrow’s garden without replaying the log.

Control lives in four places, and only there.

1. **The grammar.** Stroke, palette, the range of legal forms. This is how it stays Song Garden and stays beautiful. A lime curve on a black ground can be strange. A random palette cannot be saved by a good theory.
2. **The laws of climate.** What a deposit is allowed to change, how fast it saturates, how fast it leaks.
3. **Coupling.** How hard the birth climate is allowed to lean the organism. This is the knob that decides whether the world has memory or merely hosts stickers. Too little coupling and order does not matter. Too much and late arrivals all grow into the same weather-beaten shape, and the early voices found a world they still own.
4. **Musical constraints,** when sound exists. A scale, a register, a ceiling on density. The chord nobody wrote is whatever the log occupies inside that scale.

Deterministic, always:

- Quantized measurements to a genome. Same recording, same rules, same genome. Quantize on purpose so float noise and two browsers do not fork a life.
- Germination. Same genome, same birth climate, same rules version, same body.
- Climate update. Same log, same world.
- Placement. Hashed from the contribution id onto the field, so two identical sounds do not stack, and a reload does not wander.

Random, only as motion:

- Sway, shimmer, the breath of a thing that is already decided. The phase of that motion is hashed too, so a reload does not twitch.

Persist the causes, not the pixels.

- The ordered log: genome, rules version, time, a content pointer if the raw media is kept.
- The climate snapshot at the head of the log, as a cache. It must be reproducible by replay.
- The birth climate, or the log index, on each organism, so a body can be redrawn without simulating the universe forward every frame from scratch. Replay is for rebuilds and for new clients. Drawing is a function of stored phenotype inputs.

Do not persist a mesh, a video, or an AI picture as the source of truth. An edition, later, is a rendering of a log index. The current merch idea of pinning a snapshot still fits. The snapshot becomes a climate and a set of births, not a bloom plate.

What a viewer stores is nothing that changes the world. Perception depth is local. The log is the world.

---

## 3. Contribution → world

Treat a contribution as several different kinds of fact. Mixing them is how the mapping turns into a toy.

**Measurable.** Taken from the signal, on the device, in the moment. For a voice or a sound: duration, loudness, dynamic range, fraction of silence, spectral brightness, onset density, and pitch with a confidence. Pitch range and melodic slope only count when confidence is high. A clap has no melody, and the system has to be willing to say so. These are the first genome. They are also the honest version of “force”: energy, brightness, interruption, sustain.

**Interpreted.** A reading of meaning, only when there is language. Not a color. A few dimensions such as intimacy, tension, scale, warmth, each with a confidence. Low confidence means the dimension is ignored. These never choose a species, a hue name, or a picture.

**Organism.** What the grammar does with the genome and the birth climate. Stem, lean, branch, density of marks along the stem, openness of the bloom, how much the body answers the current pulse. The person should be able to feel that *this* gesture became *this* body, without a legend that says brightness equals thorns.

**Environment.** The deposit. Small, diffuse, and lasting. A bright sound leaves a little more light in the air. A dense rhythm leaves a faster pulse. A long silence leaves space. The deposit is not a trophy and not a landmark unlock.

**Collective.** Nothing is stored as “the collective.” Biodiversity is the spread of genomes. Harmony is how pitch residues occupy the scale. Thickness is how deposits have piled up. If a number is interesting, it is read out of the log, not authored as a stage.

**Time.** Later. Aging, compost, and a Bloom are more events in the same log. Compost returns a body to climate. A Bloom is a composed event that shocks the climate into another season. It is not frame six of a storyboard.

Mapping rules that keep it from becoming a visualizer:

- Few forces. If every audio feature has its own obvious slider, people reverse-engineer the toy, and it feels like one.
- Genome carries identity. Climate leans the body. A useful starting split is roughly: the gesture decides most of the form, the climate decides lean, spacing, and light. Then try to *see* whether order matters. Raise coupling only until it does.
- Nonlinear and saturating. The tenth bright voice does less to the air than the first. That is the wind metaphor’s other half: a tree is shaped by weather, and weather does not scale without limit.
- No emotional color code. Warmth may change glow and coupling to neighbors. It does not paint the flower yellow.
- Causality is performed once, at germination. The person hears their sound and watches the body resolve. That two-second witness is the entire explanation the system gets to give.

---

## 4. AI

AI is a later interpreter of language. It is a bad gardener.

Prefer ordinary signal processing for anything a microphone can answer. An `AnalyserNode` is already created during recording and then thrown away except for loudness. Pitch (autocorrelation or YIN), spectral centroid, and onset flux are enough to build a genome. They are immediate, private, deterministic, and free. They belong on the device. The genome is what gets stored. Do not re-analyze the file on every other phone. Device differences are how determinism quietly dies.

Prefer the grammar for anything the eye sees. No image model, no image-to-video, no “picture of a garden that represents this clip.” The Runway storyboard path stays in production for gardens that still use plates. It is not a tool in this lab.

Use a model only when the contribution is words, spoken or typed, and acoustics would get the meaning wrong. A whispered sentence and a cough can share a quiet genome. If the product cares about what was said, a single structured call can return a fixed handful of numbers and confidences. The repo already depends on `openai`. A small schema is enough. No prose, no species names, no colors.

Keep that call off the 10–20 second path. Germination uses acoustics immediately. A semantic reading may arrive a moment later as a second, smaller change in the deposit, or it may wait until language is actually in the experiment. If the model is down, the organism still exists.

Images, if they ever enter, start as measurements: palette, contrast, the amount of emptiness. A vision model that labels “joy” is the yellow-flower problem with extra steps.

Do not use AI to invent the climate, narrate the garden, or decide when it has bloomed.

---

## 5. Architecture

A lab, beside the product, sharing capture and almost nothing else.

```
device                         lab log                          every client
mic → features → genome   →    append(genome, index)      →    replay to climate
     → germinate locally        store rulesVersion              draw canvas
     → witness                  raw audio stays put             silhouettes until allowed
```

**Engine.** A pure module with no React in it: quantize, germinate, deposit, replay. Given a log and a rules version, it returns a climate and a list of organisms. This is the thing worth testing. Rendering is a skin.

**Drawing.** One 2D canvas. Organisms are polylines and a bloom mark. Climate is a ground gradient, a slow drift, a pulse. Framer Motion can keep the record control. It cannot be the field. The current growth layer is one DOM node per dot, and the particle field is a few dozen motion components by design. A living log will pass that budget as soon as it is interesting. Cap the number of fully drawn bodies. Compact the rest into climate. Phones are the place this has to run: one canvas, no video plate underneath, no continuous re-analysis.

**State.** A new log, not a new interpretation of `WorldState.energy`. Overloading the current scalars will only produce a more complicated progress bar. The log can live in a lab table or even a local file until two orders produce two worlds. When it grows up, it wants an append-only list: genome, rules version, birth index, optional media pointer, time. `garden_mutations` is the right *kind* of table and the wrong delta. Leave it alone until the lab has a delta worth writing.

**Sync.** Clients poll, then replay. They do not simulate physics at each other. Replay is how two phones share one world without a realtime engine. The current snapshot poll is the right tempo to copy. Websockets are a later optimization for “I saw your bud break the soil,” not a requirement for emergence.

**Determinism.** Genome quantized on the capturing device. Rules version frozen per garden. Placement hashed. Sway hashed. A reload is the same picture.

**Privacy and presence.** Before a contribution, the client receives climate and silhouette parameters, not raw audio and not a genome detailed enough to sing back. After a contribution, perception widens and, if the product allows, a nearby trace can carry a fragment. The seal is server-side. The beautiful version of the seal is also visual: the same world, seen through a shallower perception. Both are needed. A blur on top of a payload that already contains everyone’s chants is not a seal.

**Access.** The witness has to be visible with motion reduced: germination can complete without endless sway. The pulse cannot strobe. The act of planting has a text equivalent in the control itself (“your sound is in the ground”) so the garden is not only an image.

**Production boundary.** `/e/[slug]` and `/g/[slug]` keep their current stage. The lab is a separate route. Reuse the microphone path, the device id, haptics, and the habit of an append-only mutation log. Do not reuse storyboard frames as the sky, dots as organisms, or energy as a climate.

---

## 6. Sequence of experiments

The six phases are the right *inventory* and the wrong *order of learning*. Phase 1 can succeed completely and leave the central idea untested. A unique flower in an empty world is a visualizer. Phase 3, as a full instrument, is a second research project parked before the first one has a world. Phase 5 treats rhythm as a future feature when rhythm is just another measurement. Phase 4 is correctly late. Phase 6 is correctly last.

Run thinner experiments. Each one can fail without dragging the next one into existence.

### Experiment A — Grammar bench

**Hypothesis.** A single drawing grammar, driven by about eight numbers, can produce organisms that are clearly one family and clearly not copies.

**How.** No microphone, no server, no AI. Sliders or a handful of saved genomes. One canvas.

**Success.** Thirty forms that a person can tell apart, that still look like they grew under one law, on a phone, at a steady frame rate.

**Failure.** They collapse into one shape, or they look like unrelated generative sketches, or they only look good at settings a designer babysits. Stop. A better mapping cannot repair a grammar that has no range.

This is the smallest experiment in the brief’s neighborhood, and it is smaller than recording. Recording too early spends the learning on capture, permissions, and file formats.

### Experiment B — Voice becomes a genome

**Hypothesis.** Measurable differences in human sounds land in that grammar as visible, causal differences.

**How.** Record a few seconds. Quantize loudness, brightness, pitch confidence, contour, onset density, silence, duration. Germinate into a neutral climate. Keep the recording so a person can try to match sounds to bodies.

**Success.** Someone who did not make the sounds matches them to organisms better than chance, and still believes they are one ecosystem. The same take germinates the same body after a reload.

**Failure.** Matching is chance (the mapping is costume jewelry), or every voice becomes the same fern, or the only way to tell them apart is a gimmick you can name in one word. Do not add a climate on top of a mapping nobody can feel.

### Experiment C — The log has memory

**Hypothesis.** Order is a real force, and it does not erase the person.

**How.** Twelve genomes. Two orders. Replay both. Coupling starts low and is raised only until the two worlds are distinguishable. A second phone, before it records, sees weather and new silhouettes and cannot recover the phrase.

**Success.** The two worlds differ in lean, light, pulse, or spacing. Each organism is still recognizable as its gesture. A late arrival does not look like a punishment for being late. A second device feels presence and does not receive the idea.

**Failure.** The worlds match (coupling is theater). Or they differ and the individual is gone (coupling ate the genome). Or they differ only in a scatter nobody can see without a diagram. That last failure is the important one: emergence that cannot be perceived is not an experience.

### Experiment D — A residue you can hear

**Hypothesis.** The climate can be musical without becoming a sequencer people play on purpose.

**How.** Each genome leaves a quantized pitch residue in a fixed scale and register. The air is a quiet drone made of whoever has arrived. No lyrics. No playback of the recording into the shared field. One synth voice, few partials, built so thirty people become a chord and not a pile of noise.

**Success.** Two different groups sound different. A person can connect a new entrance to a change in the air. It still sounds like a constraint, not like a broken keyboard.

**Failure.** It sounds like a visualizer, or like mud, or the only way to keep it pleasant is to ignore the contributions and play a bed track. A bed track is the audio version of the bloom plate.

Do this only after C, and keep it small. It is the choir’s native proof that the world changed. It is not phase “generative sound” in full.

### Experiment E — Language, off to the side

**Hypothesis.** A few interpreted dimensions change the deposit in a way acoustics alone cannot, without taking over the body.

**How.** One structured model call, fixed schema, confidence gates. Words bias the deposit. The body remains the acoustic genome. If the call fails, nothing breaks.

**Success.** A quiet sentence and a quiet non-word diverge in the climate they leave, and a viewer cannot point at a color legend.

**Failure.** The outputs are mood stickers, the latency leaks into the planting moment, or turning the model off does not matter. If turning it off does not matter, leave it off.

### Experiment F — Time

**Hypothesis.** A world can keep changing after planting, including compost and a Bloom, without a designed sequence of scenes.

**How.** Aging and decay are functions of log time. Compost writes the body back into climate. A Bloom is one authored event appended to the log, produced when a real song exists, and it shifts season. People who return see a climate that moved while they were gone.

**Success.** A return visit is obviously the same garden and obviously not the same moment. The song changes the world as an event inside the laws.

**Failure.** Time is a slow crossfade between two pictures, or decay feels like deletion, or a Bloom replaces the log with a new design.

Rhythm can enter at B, as onsets, without a new phase. Text waits for E. Images wait until a palette measurement has a reason to exist. Video waits longer than images. None of these are reasons to delay A through C.

---

## 7. The prototype that can actually fail

The proposed prototype — record, measure, grow — tests whether sounds can drive a grammar. That test is Experiment B. It cannot disprove the central idea, and it can seduce the project into shipping unique flowers.

The smallest thing that can disprove the central idea is **Experiment C**: twelve contributions, two orders, two worlds, and a witness who can still point to their own organism. A and B exist so C is not a confused failure. If A fails, the drawing is the problem. If B fails, the ear-to-form link is the problem. If A and B succeed and C fails, the living world is the problem, and no amount of organism polish will fix it.

Practical shape of C, once A and B are real: a lab page, a log in memory or a file, a canvas, a second browser. No accounts, no production route, no model, no soundtrack beyond the optional drone if C is already legible to the eye. If the eye cannot see order, add the drone before declaring the idea dead. People in this practice hear collective change more readily than they see it.

---

## 8. Risks

**Already named, and how they show up here**

- *Everything looks the same.* Grammar range is too narrow, or coupling is so high that climate washes the genome out. A and C catch these separately.
- *It feels random.* Germination does not show a path from the gesture to the body, or the measurements are too weak. B’s matching test catches this.
- *Generic generative art.* The grammar has no material discipline. Limit palette and stroke before adding rules. A creative-coding demo is a failed Song Garden even if the math is alive.
- *Phones.* DOM nodes, stacked video, and per-frame React will force the idea back into dots. One canvas, a draw cap, genomes instead of everybody’s audio.
- *State gets expensive.* Simulating the field forward every frame, or storing meshes. Persist the log. Draw a function. Compact old bodies.
- *Too abstract to feel personal.* Climate with no body. The organism is the personal object. The climate is the collective one. Losing either one fails a different goal.
- *AI becomes reductive.* A model on the planting path, or a model that picks colors. Keep it late, numeric, and optional.
- *Impressive and empty.* A world nobody can connect to their two-second act. Witness has to finish inside the visit. The long life is for return, not for the price of entry.

**Further risks**

- **Founder effect.** Early deposits lock the climate and everyone else grows in their shadow. Saturation, leak, and a cap on coupling are the laws that prevent a garden from closing.
- **Imperceptible emergence.** The log is path-dependent on paper and identical in the room. If a person needs a chart, the experiment failed.
- **The bloom plate wins by inertia.** The current visual identity is a designed video. The lab will look poorer on day one. Putting the video back behind the organisms turns the grammar into a sticker on the old world.
- **Determinism leaks.** Re-analyzing audio on different sample rates, or letting sway use `Math.random()`, forks the world. Quantize once, at capture, and hash every motion.
- **The seal leaks through the genome.** A precise pitch-to-height mapping lets a bystander read the melody off the silhouette. Before contribution, send coarsened forms. Keep raw audio out of that payload.
- **Rules drift.** Changing the grammar rewrites history under people’s feet. A garden freezes its rules version. A new version is a new season, appended, not a silent edit.
- **The 10-second visit grows a tutorial.** Extra questions, naming, accounts, and “choose a flower” will return because they are easy to explain. One gesture has to be enough.
- **Musical failure mode.** An unconstrained pile of pitches sounds broken, and the fix will be a hidden backing track that ignores the log. Constrain the scale first.
- **Photosensitive pulse.** The collective pulse is a law, not a strobe.
- **Edition pressure.** Merch and show visuals want a final frame. An edition is a log index. Resist a “finished garden” export that becomes the real product.
- **Identity over months.** Device ids are enough for the lab and weak for a season of return visits. Do not block A–C on accounts. Do not pretend a device id is a community member when Experiment F starts.
- **Two simulations.** If each phone runs its own physics, they diverge. Replay one log.

---

## 9. Three other ways to build it

These are different bets about where emergence should live. The recommendation above is a hybrid of the first and the third, with coupling kept weak enough that the body survives. These three are what it looks like to choose only one.

### Botanical grammar

Each contribution grows a plant from measured parameters. The world is a composition of those plants. Climate is a light tint, or it waits.

This gets personal authorship and a recognizable garden soonest. It is the closest picture to the word “garden.” It sacrifices path dependence. Unless birth climate is allowed to bite, contribution 100 is just plant 100, and the world is a gallery. Prototype cost is moderate: a canvas and a grammar, which is Experiment A and B anyway. The trap is spending months on prettier botany and never running the two-order test. Difficulty of a *convincing* botanical simulation, with structure, wind, and growth over time, is high, and most of that difficulty is unrelated to the question.

### Chemical field

Contributions are drops into a reaction-diffusion or similar field. The world is the stain they leave. There is no organism, or the organism is only a highlight on the stain.

This gets real emergence soonest. Order matters almost for free. It can be beautiful. It sacrifices the witness. A person cannot point at a body that is theirs, and a 10-second visit ends in a texture. Song, word, and return have nowhere to live. A shader prototype is the cheapest of the three and the most likely to be emotionally empty. Making the field feel authored by a particular voice is the hard part, and it slowly reinvents the organism.

### Agent choir

Each contribution is a simple agent with a pitch residue and a position. The world is their relationships: who clusters, what drone they make, how the air moves when one enters. Drawing stays minimal. Dots, arcs, a membrane.

This is the closest to Crowdsource Choir. Collective emergence is audible. Constraints (scale, register, density) are the same kind of constraint as a show. It sacrifices the botanical picture, and it can fall into “visualizer” immediately if the drawing has no grammar. A rude prototype — a dozen oscillators and a dot that carries each one — is moderate and fast, and it tests memory in the ear. Harmonic mud is the creative failure, and it arrives early, which is a virtue. What it does not test is whether a personal *form* can carry a human gesture. If the choir only needs a living chord, this is the better whole architecture. If the garden needs someone to see a body that came from their sound, it is incomplete.

A generative landscape (erosion, deposit, terrain) is a cousin of the chemical field. It makes the wind-and-tree metaphor literal and makes “my contribution” even harder to find. It is a poor first build on a phone. It is a possible way to render climate later, under the organisms, if a gradient is too thin.

---

## 10. What to do, and what not to do

Do not start by recording. Start by drawing.

Give the lab a single grammar and a neutral canvas. Make thirty bodies by hand. If they are one world, put real voices through the same eight numbers and see whether a stranger can match them. If they can, replay two orders and look. Only if the eye can tell the worlds apart, or the ear can once a single constrained drone exists, is there a living system. Until then there is a visualizer, and the production garden should not grow a new renderer in the hope that memory will show up later.

When that memory is real, the production connection is still narrow. A garden opts into the lab. The visit stays one gesture long. The log replaces the bloom ladder for that garden only. `WorldJourney` keeps serving everyone else.

The simplest system that can still surprise is:

a frozen drawing grammar, a quantized genome, a birth climate, a deposit with a ceiling and a leak, and an ordered log that any phone can replay.

That is the whole engine. Everything else — language models, images, compost, the song returning as a season — is another event in that log, or it is a distraction from finding out whether the log is alive.
