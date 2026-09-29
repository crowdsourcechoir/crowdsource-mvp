# Felt garden — a plan for a living, returnable world

Status: **proposal** (no build in this pass)
Fits under: Song Garden V2 journey (`WorldJourney`), persistent garden (`/g/[slug]`), Roots loop
Related: [`architecture.md`](./architecture.md), [`persistent-world-spec.md`](./persistent-world-spec.md), `docs/octo-living-system-workspace.md`

---

## The aim

A person should plant something and watch the garden change because of it. They should feel other people planting at the same time. They should want to answer in a voice, because a voice leaves a richer living thing than a typed line. They should be able to sense what the crowd offered, without learning who anyone is, and without being handed answers before they have made their own. They should leave with a reason to come back: the place kept growing after they closed the phone.

That is the game. The score is the garden.

---

## Why it feels like a bucket today

The machinery for a living world is already in the product. The feeling is not.

What a participant actually gets when they submit:

1. A one-second ring and sparkle (`CelebrationBurst`), then it is gone.
2. A small glowing dot on a spiral (`WorldGrowthLayer`). Text, voice, video, and rhythm are the same dot at slightly different sizes. Shared dots from other people are dimmer versions of the same dot.
3. Every 20–40 seconds, a pill of text (`WorldPresenceTicker`): “Someone just added a sound to the garden.”
4. At the end, a closing line and, if turned on, a button to go through it again.

An earlier attempt to “grow a plant” drew vine lines for a couple of seconds and then stopped. That was removed on purpose. The storyboard behind the card can shift from dormant toward bloom, and a linked garden does store shared energy, layers, and marks. Those systems change numbers. They do not yet perform a planting.

Two other facts shape the plan:

- **People type because typing is the easy, safe, equal choice.** On a prompt with more than one channel, Type, Record, Video, and Photo are the same size circles. Record then asks for the microphone, runs a countdown, captures up to about twenty seconds, and asks for a review. Type is a box and Continue. Nothing in the garden looks or sounds better if you sang.
- **Other people are a caption.** The activity feed is aggregate counts and clips. It never shows a plant happening. The persistent-world spec already says there is no public leaderboard and no raw media in the snapshot. That privacy line stays. The missing piece is a visible, audible, haptic event that still carries no name and no answer.

The Roots loop is already the right game loop. Invitation, risk, contribution, recognition, response, collective effect, belonging, deeper participation. The journey currently completes contribution and then skips recognition and collective effect. Belonging has nothing to attach to, so there is nothing to return to.

---

## Principles

1. **The reward is a change you can point at.** A flower that opened, a color that entered the bed, a tone that stayed in the air, a plot that is fuller when you come back. Points, badges, streaks, and leaderboards would turn original answers into a contest and would expose who is “ahead.” They stay out.
2. **Seal the prompt until you have answered it.** Before you plant on a question, you may see that the bed is alive. You may not read, hear, or see anyone’s answer to that question.
3. **After you plant, you meet traces, not people.** No names, no faces, no account photos. A written answer can become a short anonymous line. A sung answer can become a tone or a brief masked phrase. A photo contributes color. The picture itself stays out of the shared field unless a later, explicit public-display consent says otherwise.
4. **Do not show the answer that just landed beside you.** In a room, the newest submission is often the person next to you, and it is also the easiest thing to copy. After you answer, the bed opens onto a shuffled, slightly delayed set of earlier traces.
5. **Voice is the beautiful path. Text still plants.** Nobody is blocked or scolded for typing. A typed answer grows a leaf. A sung or spoken answer grows a flower you can tap and hear. The garden’s shared air thickens more from voice than from text. The choice should feel like choosing the richer plant.
6. **Keep the journey short.** More interaction does not mean more questions. The extra points of contact are the plant, the replay, the sealed bed opening, and the return visit.
7. **The garden is not the show.** It collects. Composer and the Bloom decide what the room actually sings. The garden does not become an open mic or a feed that invents structure.

---

## A visit, as it should feel

You open the link. The place is already moving: light, a slow drift, and somewhere in the beds a few closed buds shifting as if the soil is working. You do not know what anyone said. You know you are not first, and you are not alone.

The first real prompt is a single question. The large circle says Sing. Under it, smaller, is Write instead. You tap Sing. The circle listens. Your volume moves the ring, so the recording is itself a little game. It is one phrase, a few seconds, not a performance.

You let go. The card recedes. A seed drops into a specific spot that is yours. The soil lifts. A stem rises and a flower opens over about two seconds. Your phrase plays back once from that flower, quiet, as if it is sitting in the ground. The phone gives a short pulse. The light of the whole garden warms and stays warmer. That flower remains.

Only then does the bed unseal. Other flowers are already there, anonymous. You can open one. You hear a tone, or a couple of words that are not yours, from someone who answered earlier. You still do not know who. You were not shown this before you sang, so your phrase was yours.

While you are on the next prompt, someone else plants. You do not get a text bubble. A new bud in another bed pushes up out of the soil. If it was a voice, the air picks up a muffled pitch for a moment, with no lyric in it. You feel the room.

You finish. The closing screen is your plot, not a thank-you card. Your flower is in front. The beds you completed are open. The ones you skipped stay sealed. You can leave.

You come back the next day from the same phone. Your flower is where you left it. Around it, new growth has appeared, highlighted the way morning light hits new leaves. One line is enough if the picture is not: the garden grew while you were away. If a Bloom later sings something built from these seeds, that piece is playable here. That is the deepest reward, and it belongs to Composer, not to a scoreboard.

---

## Four moves

### 1. Planting ritual

Replace the dot-pop with a short staged growth that finishes and then stays.

Same skeleton for every contribution:

| Beat | What you see and feel | About |
| --- | --- | --- |
| Release | The answer leaves the card and falls to a spot | 0.4s |
| Soil | A mound opens at that spot | 0.4s |
| Rise | A stem or leaf grows in place | 0.8s |
| Open | The plant settles into its idle life | 0.6s |
| Stay | It remains for the rest of the visit and on return | forever |

Kind changes the plant, not the timing:

| What you gave | What grows | What you can do with it |
| --- | --- | --- |
| Typed words | A leaf | Tap to read your own line |
| Spoken or sung voice | A flower | Tap to hear your own phrase |
| Rhythm (stomp, clap, snap) | A low pulse in the ground | Tap to hear the hit |
| Photo | A petal washed with the photo’s color | Your picture stays private |
| Video | A brief lantern of light | Stays as light, not a looping face |

Build this as a few motion stages (seed, mound, stem, bloom) on the existing growth-node position. Do not bring back self-drawing vine lines. Those read as a sketch that stops. A plant has to arrive and then keep living: a slow sway, a breath in the glow, the same way the current dots pulse, except it has to look like growth on the way in.

Your plant is bright and in front. Other people’s plants use the same animation at a smaller scale when the garden version changes. The sparkle burst can remain as a glint on the soil at the moment of impact. It stops being the whole reward.

Haptics already fire on your own plant. Add a softer tick when someone else’s plant breaks the soil.

### 2. Sealed beds

Each prompt is a bed in the garden.

**Before you answer that prompt**

- Closed buds show density. A bed with many answers looks planted. A quiet bed looks bare.
- Recent activity is motion in the soil.
- Kind is weather. Voices lift the air. Rhythm moves the ground. Words add leaves. Photos shift the color. This already matches `WorldState.layers`.
- No words, no recordings, no pictures, no names.

**After you answer that prompt**

- Your plant is fully yours immediately.
- The bed opens onto anonymous traces from earlier answers, shuffled, held back by a few minutes so the newest neighbor does not appear on your screen.
- A trace is partial on purpose. A line, not the whole story. A tone or a masked second, not the full take. A color, not the photo.
- You can open a few. You are visiting, not scrolling a feed.

**If you never answer it**

- That bed stays sealed for you. Skipping is allowed. Curiosity is not a key.

The public garden (`/g/[slug]`) follows the same rule. A visitor who has not walked the journey sees a living field of closed growth, energy, and weather. They do not browse raw answers. Their own device, if they have planted before, still opens the beds they completed and their own replays.

### 3. Make voice the path of least resistance

People type because the product makes typing easy and makes singing a chore with the same payoff. Change the chore and the payoff together.

- On creative prompts, the primary control is a listen-circle: Sing, or Speak, using the prompt’s own verb. Write instead sits underneath as a text button, available, not equal.
- Capture one phrase. Aim for about six to eight seconds, with a clear stop, instead of a long take plus a review maze. One confirm: Plant it. Playback of your own take happens on the flower, so the review is the reward.
- The ring already follows microphone level in `VoiceMomentPad`. Keep that. It is the moment of play inside the recording.
- After planting, the flower replays your phrase once, then waits for you to tap it. That replay is private to your device.
- In the shared world, a voice moves the vocal or voice layer more than a typed answer moves the text layer. The air of the garden is the shared reward. Other people hear weather, not your lyric.
- Photos stay one tap into the camera, and their reward is color in the bed. Do not promise that a selfie will be seen. Identity is the thing we are protecting.

Name and email steps stay typed. They are not creative beds.

### 4. A reason to come back

The completion screen becomes the plot.

- Your plants are gathered where you can touch them.
- Beds you finished are open. Others stay sealed.
- The same link, on the same phone, restores that plot. Device marks already exist for this. The page has to look like a return, not like a restart.
- On a later open, growth that appeared since your last visit is the thing you notice first. New plants ease in. Older ones are simply there. A single line can support the picture: the garden grew while you were away.
- Between Blooms, `/g/[slug]` is that same plot inside the longer garden, not a separate map with a text box as the only sign of life.
- The long reward is musical. When Composer turns seeds into something the Bloom can sing, that piece can play in the garden. You hear the crowd, and your private flower is the proof you are in it. That is a later chapter. The plant, the sealed bed, and the return visit come first.

---

## What stays out

- Points, XP, badges, streaks, and public ranks.
- Names, avatars, and faces in the shared field.
- Full answers visible before you have answered that prompt.
- The newest submission shown to the person who just planted.
- A mascot, a character, or vine-lines that draw and stop.
- Extra questions added only to create more taps.
- A social feed of raw clips.

---

## How to start

Each step should be feelable on a real phone before the next one starts. Two phones on one garden are the test: one plants, the other sees and feels it, and neither can read the other’s answer early.

### First build — the plant

No new questions and no new public content.

- Staged growth for your own contribution, different plant by kind, staying on screen.
- When a linked garden’s version bumps, other people’s new nodes play the smaller version of that same growth, with a soft haptic.
- Personal marks stay brighter than shared ones, as they do now.
- The text ticker becomes the accessible whisper for people who need words, and it yields the moment whenever a plant is actually growing.

This is the bucket fix. It uses `WorldGrowthLayer`, `useCelebration`, `pulseHaptic`, and the snapshot poll that already runs.

### Second build — sealed beds

- A bed per prompt.
- Closed buds and weather before you answer.
- After you answer, a small set of anonymous partial traces, delayed and shuffled.
- Your own full text or recording available only on your plant.
- One server rule for what a trace may contain, so the journey and `/g/[slug]` cannot drift apart.

### Third build — voice as the primary creative act

- Sing / Speak as the large action, Write instead underneath.
- Short phrase, one Plant confirmation, replay on the flower.
- Voice and song move shared layers more than text.

### Fourth build — return

- Completion is the plot.
- Reopen shows what grew since last visit.
- The public garden uses the same plants and the same seals.

The composed “garden sings back” piece waits until those four are real. It needs Composer, consent, and a Bloom. It is the reward the garden is growing toward.

---

## Where this lands in the current code

| Idea | Already here | This plan adds |
| --- | --- | --- |
| Continuous world behind the card | `WorldStage` never unmounts | Plants live in that world, not inside the card |
| Personal vs shared marks | `myMarks` bright, field nodes dim | Same split, with a real grow-in for both |
| Shared vitality | `WorldState.energy`, `layers`, landmarks | Weather you can see; voice weighs more than text |
| Celebration | `CelebrationBurst` + haptic on your submit | Glint on impact; the plant is the celebration |
| Other people | Presence ticker, 25s snapshot poll | A plant animation on version change |
| Privacy of raw media | Snapshot has no media | Traces are a separate, sealed, partial read |
| Voice capture | `VoiceMomentPad` circle, level, countdown | Shorter phrase, primary button, replay on the flower |
| Return identity | Song Garden device id | Plot restores; new growth since last visit is highlighted |

---

## Success, in the room

A person who only wanted to type still finishes, and they can see a leaf that is theirs.

A person who is willing to sing sees a flower and can hear themselves in it.

A second phone, watching, sees that flower come up out of the soil without learning the phrase or the name.

Someone who finished yesterday can open the same link and tell that the garden is not where they left it.
