"use client";

import { useState } from "react";
import type { Event } from "@/data/mockEvents";

type ConductorViewProps = {
  event: Event;
  stages: string[];
};

export default function ConductorView({ event, stages }: ConductorViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentStage = stages[currentIndex];

  return (
    <div className="flex gap-6">
      <aside className="w-56 shrink-0 rounded-xl border border-gray-700/60 bg-[#18181b] p-4">
        <h3 className="text-sm font-semibold text-gray-400">Stages</h3>
        <ul className="mt-3 space-y-1">
          {stages.map((stage, i) => (
            <li key={stage}>
              <button
                type="button"
                onClick={() => setCurrentIndex(i)}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                  i === currentIndex
                    ? "bg-gray-700 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
              >
                {stage}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="min-w-0 flex-1 rounded-xl border border-gray-700/60 bg-[#18181b] p-6">
        <p className="text-sm text-gray-500">Event</p>
        <h2 className="mt-1 text-lg font-semibold text-white">{event.title}</h2>
        <p className="mt-4 text-sm font-medium text-gray-400">Current stage</p>
        <p className="mt-1 text-xl font-semibold text-white">{currentStage}</p>
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => Math.min(stages.length - 1, i + 1))}
            disabled={currentIndex === stages.length - 1}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
