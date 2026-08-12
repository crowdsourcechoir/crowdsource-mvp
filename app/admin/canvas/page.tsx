import Link from "next/link";

const canvasAreas = [
  {
    title: "Garden canvas",
    description: "Open a Garden to tend its map, chapters, memory, and composition surface.",
    href: "/admin/gardens",
    cta: "Open Gardens",
  },
  {
    title: "Bloom canvas",
    description: "Open a Bloom to review contributions, media, song seeds, memory, and live prep.",
    href: "/admin/events",
    cta: "Open Blooms",
  },
  {
    title: "Song Garden audio canvas",
    description: "Use the event-specific canvas for audio clips, pads, and pre-show musical material.",
    href: "/admin/events",
    cta: "Choose a Bloom",
  },
  {
    title: "Composition brief",
    description: "Shape collected voices, words, sounds, images, and videos into musical direction.",
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

export default function CanvasPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 text-white">
      <section className="rounded-3xl border border-purple-400/20 bg-[#121214] p-6 shadow-2xl shadow-black/30 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-purple-300">Creative workspace</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Canvas</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-300 sm:text-base">
          The workspace for arranging, curating, composing, and preparing the material that lets a
          Garden Bloom. Canvas is where collected human presence becomes usable show, gameday, and
          anthem material.
        </p>
      </section>

      <section className="rounded-2xl border border-gray-800 bg-black/25 p-5">
        <h2 className="text-lg font-semibold text-white">First-class contribution media</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
          Contributions are not only audio or text. Photos, selfies, submitted videos, and short
          crowd clips belong in the same living archive so they can become show visuals, gameday
          moments, sponsor activations, and post-event memories.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {contributionTypes.map((type) => (
            <span key={type} className="rounded-full border border-gray-700 bg-[#18181b] px-3 py-1.5 text-sm text-gray-200">
              {type}
            </span>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white">Current Canvas entry points</h2>
          <p className="mt-1 text-sm text-gray-400">
            These links consolidate the creative/admin surfaces that were previously scattered.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {canvasAreas.map((area) => (
            <Link
              key={area.title}
              href={area.href}
              className="rounded-2xl border border-gray-800 bg-[#18181b] p-5 transition hover:border-purple-300/50 hover:bg-[#202024]"
            >
              <h3 className="text-base font-semibold text-white">{area.title}</h3>
              <p className="mt-2 min-h-[3rem] text-sm leading-6 text-gray-400">{area.description}</p>
              <span className="mt-4 inline-flex text-sm font-semibold text-purple-200">
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
