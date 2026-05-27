"use client";

import { useState } from "react";
import { Bebas_Neue } from "next/font/google";
import type { Event } from "@/data/mockEvents";
import { formatDateLong } from "@/lib/formatDate";
import ParticipantJourney from "@/components/participant-journey/ParticipantJourney";
import JourneyHeader from "@/components/participant-journey/JourneyHeader";
import { readJourneyActiveFromStorage } from "@/lib/participant-journey/read-journey-active";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
});

type ExperiencePanel = "landing" | "anthem" | "songgarden";

type PublicEventContentProps = {
  event: Event;
  initialPanel?: ExperiencePanel;
};

export default function PublicEventContent({
  event,
  initialPanel = "landing",
}: PublicEventContentProps) {
  const [photoMode] = useState<"bw" | "color">(event.heroImageMode === "color" ? "color" : "bw");
  const startAtGarden = initialPanel === "songgarden";
  const [journeyActive, setJourneyActive] = useState(() =>
    readJourneyActiveFromStorage(event, startAtGarden)
  );
  const compactHeader = journeyActive || startAtGarden;

  return (
    <div
      className={`relative min-h-[100dvh] overflow-x-hidden overflow-y-auto text-gray-100 [color-scheme:dark] pt-[env(safe-area-inset-top)] ${
        journeyActive ? "pb-0" : "pb-[env(safe-area-inset-bottom)]"
      }`}
      style={{ ["--crowdsource-accent" as string]: "#CFFF81" }}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/public-bg.png')" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/20" aria-hidden />

      <div
        className={`relative z-10 mx-auto flex min-h-[100dvh] w-full min-w-0 max-w-3xl flex-col px-[max(1rem,env(safe-area-inset-left))] text-center sm:px-5 ${
          compactHeader ? "py-3 sm:py-5" : "py-6 sm:py-10"
        }`}
      >
        {compactHeader ? (
          <JourneyHeader title={event.title} />
        ) : (
          <>
            <a
              href="https://crowdsourcechoir.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mx-auto mb-10 block w-fit opacity-95"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Crowdsource Choir" className="h-16 w-auto sm:h-20" />
            </a>

            {event.heroImage && (
              <div className="mx-auto mb-6 w-full max-w-64 sm:mb-8 sm:max-w-72">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={event.heroImage}
                  alt=""
                  className={`aspect-square w-full object-cover ${photoMode === "bw" ? "grayscale" : ""}`}
                />
              </div>
            )}

            <div className="mx-auto w-full max-w-2xl">
              <h1
                className={`${bebasNeue.className} mt-2 break-words text-4xl leading-none tracking-wide text-[var(--crowdsource-accent)] sm:text-5xl md:text-6xl`}
              >
                {event.title}
              </h1>
              <p className="mt-2 font-mono text-base text-gray-100">
                <span className="text-[var(--crowdsource-accent)]">{formatDateLong(event.date)} · </span>
                <span>{event.venue}</span>
                {event.address ? <span className="text-gray-300"> ({event.address})</span> : null}
              </p>
            </div>
          </>
        )}

        <div className={compactHeader ? "flex w-full min-w-0 flex-1 flex-col" : "mt-6 w-full min-w-0 space-y-6 pt-2"}>
          <ParticipantJourney
            event={event}
            startAtGarden={startAtGarden}
            onActiveChange={setJourneyActive}
          />
        </div>
      </div>
    </div>
  );
}
