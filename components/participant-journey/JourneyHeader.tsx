"use client";

import { Bebas_Neue } from "next/font/google";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
});

type JourneyHeaderProps = {
  title: string;
};

/** Minimal logo + title shown during the participant journey (Option A). */
export default function JourneyHeader({ title }: JourneyHeaderProps) {
  return (
    <header className="mb-3 sm:mb-4">
      <a
        href="https://crowdsourcechoir.com"
        target="_blank"
        rel="noopener noreferrer"
        className="mx-auto block w-fit opacity-95"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Crowdsource Choir" className="h-12 w-auto sm:h-14" />
      </a>
      <h1
        className={`${bebasNeue.className} mx-auto mt-3 line-clamp-2 break-words text-3xl leading-none tracking-wide text-[var(--crowdsource-accent)] sm:text-4xl`}
      >
        {title}
      </h1>
    </header>
  );
}
