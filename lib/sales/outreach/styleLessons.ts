/**
 * Durable outreach style lessons distilled from operator edits (ACE Annual Meeting,
 * NLC City Summit / Nashville, etc.). Injected into draft + nudge prompts every run so
 * learning survives beyond the last-3 few-shot window.
 */
export const OUTREACH_STYLE_LESSONS = `--- DURABLE STYLE LESSONS (from operator edits — follow every time) ---
1. Audience precision: name the specific leadership audience, not a vague sector label.
   Prefer "higher education leaders" over "educators"; "local leaders whose work is centered on building stronger communities" over generic "attendees." Match the prospect's actual role world.
2. No invented past partnerships: never write "we have successfully partnered with organizations like yours," "we've worked with groups like yours," or similar social proof unless findings name a real shared engagement you can cite. Fit stands on what THIS audience does, not fake history.
3. Lead with the strongest hook: if findings mention a distinctive place, theme, or moment (e.g. City Summit in Music City / Nashville), put that in openingReason — do not bury it. Weak: generic "I think it could enhance the conference." Strong: "When I saw that City Summit is coming to Music City, I thought there could be a really natural fit."
4. Connect Crowdsource Choir to the audience's actual work: one concrete fitReason paragraph — attendees contribute voices/ideas → original anthem the room performs → why that matters for THIS room (shared purpose for higher-ed leaders navigating change; belonging/community for local leaders; Music City spirit + community-building when the venue warrants it). Avoid corporate fluff ("fostering deep community engagement," "amplifies important discussions").
5. Closing warmth: prefer "Thanks, {first name}!" when natural; keep the CTA soft (connect, or intro to whoever leads programming). Mention next year only when findings suggest this year's programming may already be set — don't invent that constraint.
6. Prefer the edited gold structure: warm greeting → self-intro → hooky openingReason → one grounded fitReason paragraph → book link → soft CTA → thanks.`;

/** Gold-standard edited emails from the operator — concrete voice beats adjectives. */
export const OUTREACH_GOLD_EDIT_EXAMPLES = `--- GOLD EDIT A (ACE Annual Meeting — higher-ed leaders, not generic educators) ---
Hi Robert,

I hope you're doing well!

I'm Joel DeJong, founder of Crowdsource Choir — a participatory musical experience where the audience becomes the choir. I wanted to reach out because I think it could be a natural fit for the ACE Annual Meeting.

We invite attendees to contribute their voices and ideas around the themes at the heart of the gathering, then bring those contributions together into an original anthem the whole room performs. For higher education leaders navigating a rapidly changing landscape, it could be a powerful way to explore shared purpose and turn it into something they actually create together.

I've included a bit more about the experience here:
https://www.crowdsourcechoir.com/book

If it feels like it could be a fit, I'd love to connect — or if there's someone else on your team who leads Annual Meeting programming, I'd welcome an introduction.

Thanks, Robert!

Best,
Joel

--- GOLD EDIT B (NLC City Summit in Nashville — lead with Music City; audience builds communities) ---
Hi Clarence,

I hope you're doing well!

I'm Joel DeJong, founder of Crowdsource Choir — a participatory musical experience where the audience becomes the choir. When I saw that City Summit is coming to Music City, I thought there could be a really natural fit.

We invite attendees to contribute their voices and ideas around the themes at the heart of the gathering, then bring those contributions together into an original anthem the whole room performs. For thousands of local leaders gathering in Nashville, it could be a fun and meaningful way to connect the spirit of Music City with the work of building stronger communities.

I've included a bit more about the experience here:
https://www.crowdsourcechoir.com/book

If it feels like it could be a fit, I'd love to connect — or if there's someone else who leads City Summit programming, I'd welcome an introduction.

Thanks, Clarence!

Best,
Joel

Operator notes on those edits (apply the same judgment):
- Shift from generic "educators" → "higher education leaders" and name the shared challenge they navigate.
- Delete "successfully partnered with organizations like yours" unless you can name a real municipal example.
- Strongest connection for city/local orgs: their work is literally about building communities.
- When the event is in Nashville / Music City, lead with that hook — don't bury it.`;
