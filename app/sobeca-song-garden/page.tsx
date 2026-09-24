import type { Metadata } from "next";
import { Bebas_Neue, Space_Mono } from "next/font/google";
import type { CopyBlock } from "./content";
import { slides } from "./content";

const display = Bebas_Neue({ weight: "400", subsets: ["latin"] });
const mono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SoBECA Song Garden",
  description: "A Living Participatory Arts Initiative",
  robots: { index: false, follow: false },
};

function Block({ block }: { block: CopyBlock }) {
  if (block.type === "title") {
    return (
      <h1 className={`${display.className} max-w-6xl text-6xl leading-[0.9] tracking-wide sm:text-8xl`}>
        {block.text}
      </h1>
    );
  }
  if (block.type === "heading") {
    return (
      <h2 className={`${display.className} max-w-5xl text-5xl leading-[0.92] tracking-wide sm:text-7xl`}>
        {block.text}
      </h2>
    );
  }
  if (block.type === "kicker") {
    return (
      <p className="mt-4 text-xs font-bold uppercase tracking-[0.28em] text-white/80 sm:text-sm">{block.text}</p>
    );
  }
  if (block.type === "line") {
    return <p className={`${display.className} mt-8 max-w-5xl text-3xl leading-tight tracking-wide sm:text-5xl`}>{block.text}</p>;
  }
  if (block.type === "paragraph") {
    return <p className="mt-5 max-w-3xl text-base leading-relaxed text-white/95 sm:text-lg">{block.text}</p>;
  }
  if (block.type === "list") {
    return (
      <ul className="mt-6 max-w-3xl space-y-2 text-base leading-relaxed text-white/95 sm:text-lg">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className="mt-8 max-w-5xl overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm sm:text-base">
        <thead>
          <tr>
            {block.headers.map((header) => (
              <th key={header} className="border-b border-white/30 py-3 pr-6 font-bold uppercase tracking-[0.14em]">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.join("|")} className="align-top">
              {row.map((cell) => (
                <td key={cell} className="border-b border-white/15 py-4 pr-6 leading-relaxed">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SobecaSongGardenPage() {
  return (
    <main className={`${mono.className} bg-black text-white`}>
      {slides.map((slide) => (
        <section key={slide.id} className="relative min-h-[100dvh] w-full">
          <img
            src={slide.image}
            alt={slide.imageAlt}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative z-10 w-full px-6 py-16 sm:px-12 sm:py-20 lg:px-16">
            <img src="/sobeca-song-garden/logo.png" alt="Crowdsource Choir" className="mb-10 h-10 w-auto sm:h-12" />
            {slide.blocks.map((block) => (
              <Block key={`${slide.id}-${block.type}-${"text" in block ? block.text : block.type}`} block={block} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
