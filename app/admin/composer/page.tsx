import Link from "next/link";

const composerAreas = [
  {
    title: "Garden material",
    description: "Open a Garden to tend its map, chapters, memory, and arrangement surface.",
    href: "/admin/gardens",
    cta: "Open Gardens",
  },
  {
    title: "Bloom material",
    description: "Open a Bloom to review contributions, media, song seeds, memory, and live prep.",
    href: "/admin/events",
    cta: "Open Blooms",
  },
  {
    title: "Song Garden audio pads",
    description: "Use the event-specific arrangement surface for audio clips, pads, and pre-show musical material.",
    href: "/admin/events",
    cta: "Choose a Bloom",
  },
  {
    title: "Composition brief",
    description: "Turn collected voices, words, sounds, images, and videos into musical direction and song material.",
    href: "/admin/composition/brief",
    cta: "Open brief",
  },
];

const contributionTypes = [
  "Voice",
  "Words",
  "Sounds",
  "Photos",
  "Selfies",
  "Videos",
  "Chants",
  "Ambient moments",
];

export default function ComposerPage() {
  return (
    <div className="w-full space-y-8 text-white">
      <div className="mb-6 sm:mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">
          Musical formation
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Composer</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">
          Where living inputs become musical compositions. Composer gathers voice, words, sounds, images, and video
          from a Garden or Bloom and shapes them into songs, chants, anthems, and show material — with the room, not
          instead of it.
        </p>
      </div>

      <section className="rounded-xl border border-gray-800 bg-[#121214] p-5">
        <h2 className="text-lg font-semibold text-white">First-class contribution media</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
          Contributions are not only audio or text. Photos, selfies, submitted videos, and short crowd clips belong in
          the same living archive so they can become show visuals, gameday moments, sponsor activations, and
          post-event memories.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {contributionTypes.map((type) => (
            <span
              key={type}
              className="rounded-full border border-gray-700 bg-[#18181b] px-3 py-1.5 text-sm text-gray-200"
            >
              {type}
            </span>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Composer entry points</h2>
          <p className="mt-1 text-sm text-gray-400">
            Surfaces for gathering material and forming it into musical compositions.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {composerAreas.map((area) => (
            <Link
              key={area.title}
              href={area.href}
              className="rounded-xl border border-gray-800 bg-[#121214] p-5 transition hover:border-[#CFFF81]/50 hover:bg-[#18181b]"
            >
              <h3 className="text-base font-semibold text-white">{area.title}</h3>
              <p className="mt-2 min-h-[3rem] text-sm leading-6 text-gray-400">{area.description}</p>
              <span className="mt-4 inline-flex text-sm font-semibold text-[#CFFF81]">
                {area.cta}
                {" ->"}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
