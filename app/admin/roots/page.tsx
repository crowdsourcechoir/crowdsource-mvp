import Link from "next/link";

const rootPrinciples = [
  "Invitation",
  "Risk",
  "Contribution",
  "Recognition",
  "Response",
  "Collective effect",
  "Belonging",
  "Deeper participation",
];

const rootTools = [
  {
    title: "Bloom conductor",
    description: "Open a Bloom, then use conductor tools to guide show arc, cues, and live facilitation.",
    href: "/admin/events",
    cta: "Choose a Bloom",
  },
  {
    title: "Composition brief",
    description: "Transform collected contributions into anthem, chant, warm-up, and motif direction.",
    href: "/admin/composition/brief",
    cta: "Open brief",
  },
  {
    title: "Resonance signal",
    description: "Prototype the real-time sensing side of the Root System.",
    href: "/admin/resonance",
    cta: "Open resonance",
  },
  {
    title: "Live tools",
    description: "Launch prompt games and signal moments that can become repeatable participation loops.",
    href: "/admin/live",
    cta: "Open Live",
  },
];

export default function RootsPage() {
  return (
    <div className="w-full space-y-8 text-white">
      <div className="mb-6 sm:mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">Root System</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Roots</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">
          The hidden participation methodology, musical intelligence, memory, and facilitation logic that help a
          Garden come alive during a Bloom.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="rounded-xl border border-gray-800 bg-[#121214] p-5">
          <h2 className="text-lg font-semibold text-white">Participation loop</h2>
          <p className="mt-2 text-sm leading-6 text-gray-400">
            Roots protect the loop that moves people from spectatorship into shared creation.
          </p>
          <ol className="mt-5 space-y-2">
            {rootPrinciples.map((principle, index) => (
              <li key={principle} className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#CFFF81]/15 text-xs font-bold text-[#CFFF81]">
                  {index + 1}
                </span>
                <span className="text-sm text-gray-200">{principle}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-xl border border-gray-800 bg-[#121214] p-5">
          <h2 className="text-lg font-semibold text-white">What belongs here</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              "Invitation design",
              "Musical taste and arrangement rules",
              "Sample-to-anthem transformation",
              "Chant and warm-up logic",
              "Facilitator decision patterns",
              "Signal and participation thresholds",
              "Recognition and reward moments",
              "Belonging and escalation design",
            ].map((item) => (
              <div key={item} className="rounded-lg border border-gray-800 bg-[#0c0c0e] px-4 py-3 text-sm text-gray-300">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Current Roots-facing tools</h2>
          <p className="mt-1 text-sm text-gray-400">
            These are not the whole Root System, but they are the current admin entry points into it.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {rootTools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="rounded-xl border border-gray-800 bg-[#121214] p-5 transition hover:border-[#CFFF81]/50 hover:bg-[#18181b]"
            >
              <h3 className="text-base font-semibold text-white">{tool.title}</h3>
              <p className="mt-2 min-h-[3rem] text-sm leading-6 text-gray-400">{tool.description}</p>
              <span className="mt-4 inline-flex text-sm font-semibold text-[#CFFF81]">
                {tool.cta}
                {" ->"}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
