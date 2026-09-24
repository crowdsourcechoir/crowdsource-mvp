import type { Metadata } from "next";
import { Bebas_Neue, Space_Mono } from "next/font/google";
import { slides } from "./content";

const display = Bebas_Neue({ weight: "400", subsets: ["latin"] });
const mono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Song Garden",
  description: "Proposal for NPC 2027 in Houston",
  robots: { index: false, follow: false },
};

export default function SobecaSongGardenPage() {
  return (
    <main className={`${mono.className} bg-black text-white`}>
      {slides.map((slide) => (
        <section
          key={slide.id}
          className="relative flex min-h-[100dvh] w-full items-end"
        >
          <img
            src={slide.image}
            alt={slide.imageAlt}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/25" />
          <div className="relative z-10 w-full px-6 py-16 sm:px-12 sm:py-20 lg:px-20">
            <img
              src="/sobeca-song-garden/logo.png"
              alt="Crowdsource Choir"
              className="mb-8 h-10 w-auto sm:h-14"
            />
            {slide.kicker ? (
              <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-white/80 sm:text-xs">
                {slide.kicker}
              </p>
            ) : null}
            {slide.title ? (
              <h2
                className={`${display.className} mt-3 max-w-6xl text-5xl leading-[0.9] tracking-wide text-white sm:text-7xl lg:text-8xl`}
              >
                {slide.title}
              </h2>
            ) : null}
            {slide.paragraphs?.map((paragraph) => (
              <p
                key={paragraph}
                className="mt-6 max-w-4xl text-lg leading-relaxed text-white sm:text-2xl"
              >
                {paragraph}
              </p>
            ))}
            {slide.columns ? (
              <div className="mt-10 grid gap-8 lg:grid-cols-3">
                {slide.columns.map((column) => (
                  <div key={column.label}>
                    <h3 className={`${display.className} text-4xl tracking-wide sm:text-5xl`}>
                      {column.label}
                    </h3>
                    <p className="mt-3 text-base leading-relaxed text-white/90 sm:text-lg">
                      {column.body}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
            {slide.steps ? (
              <div className="mt-10 flex flex-wrap gap-6">
                {slide.steps.map((step) => (
                  <p key={step} className={`${display.className} text-3xl tracking-[0.2em] sm:text-4xl`}>
                    {step}
                  </p>
                ))}
              </div>
            ) : null}
            {slide.chips ? (
              <ul className="mt-8 flex flex-wrap gap-3">
                {slide.chips.map((chip) => (
                  <li
                    key={chip}
                    className="border border-white/40 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em]"
                  >
                    {chip}
                  </li>
                ))}
              </ul>
            ) : null}
            {slide.lists ? (
              <div className="mt-10 grid gap-10 lg:grid-cols-2">
                {slide.lists.map((list) => (
                  <div key={list.heading}>
                    <h3 className={`${display.className} text-3xl tracking-wide sm:text-4xl`}>
                      {list.heading}
                    </h3>
                    <ul className="mt-4 space-y-2 text-sm leading-relaxed text-white/90 sm:text-base">
                      {list.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
            {slide.cards ? (
              <div className="mt-10 grid gap-6 sm:grid-cols-2">
                {slide.cards.map((card) => (
                  <div key={card.title} className="border border-white/30 p-6">
                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/70">
                      {card.label}
                    </p>
                    <h3 className={`${display.className} mt-2 text-4xl tracking-wide`}>{card.title}</h3>
                    <p className="mt-2 text-sm text-white/85">{card.body}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {slide.closing ? (
              <div className="mt-12 text-sm leading-relaxed text-white/90 sm:text-base">
                <p>Joel DeJong</p>
                <p>Founder, Crowdsource Choir</p>
                <p>
                  <a className="underline" href="mailto:sing@crowdsourcechoir.com">
                    sing@crowdsourcechoir.com
                  </a>
                </p>
                <p>
                  <a className="underline" href="https://www.crowdsourcechoir.com">
                    CrowdsourceChoir.com
                  </a>
                </p>
              </div>
            ) : null}
          </div>
        </section>
      ))}
    </main>
  );
}
