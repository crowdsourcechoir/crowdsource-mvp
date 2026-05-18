"use client";

import { useMemo, useState } from "react";
import {
  buildCrowdsourceCampaign,
  crowdsourceMarketingAgent,
  type CrowdsourceMarketingAgentInput,
} from "@/data/crowdsourceMarketingAgent";

const initialInput: CrowdsourceMarketingAgentInput = {
  eventName: "",
  date: "",
  venue: "",
  theme: "",
  audience: "",
  assets: "",
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  const className =
    "mt-1 block w-full rounded-xl border border-gray-700/60 bg-[#1f1f1f] px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-600";

  return (
    <label className="block">
      <span className="text-sm font-semibold text-gray-300">{label}</span>
      {multiline ? (
        <textarea
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
        />
      )}
    </label>
  );
}

function CopyBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-gray-700/60 bg-[#111114] p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(text)}
          className="rounded-lg border border-gray-700 bg-[#1f1f1f] px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-[#2a2a2a]"
        >
          Copy
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{text}</p>
    </div>
  );
}

export default function MarketingAgentPage() {
  const [input, setInput] = useState<CrowdsourceMarketingAgentInput>(initialInput);
  const campaign = useMemo(() => buildCrowdsourceCampaign(input), [input]);

  function setField<K extends keyof CrowdsourceMarketingAgentInput>(
    key: K,
    value: CrowdsourceMarketingAgentInput[K]
  ) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white">
      <div className="mb-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-gray-700/60 bg-[#18181b] p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-300">
            {crowdsourceMarketingAgent.shortName}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {crowdsourceMarketingAgent.name}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-gray-300">
            {crowdsourceMarketingAgent.purpose}
          </p>
          <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-amber-200">Core strategic insight</p>
            <p className="mt-2 text-sm leading-relaxed text-amber-50/90">
              {crowdsourceMarketingAgent.strategicInsight}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-gray-700/60 bg-[#18181b] p-5 sm:p-7">
          <h2 className="text-lg font-bold text-white">Shared core memory</h2>
          <p className="mt-2 text-sm text-gray-400">
            The first version keeps public event marketing, private-event sales, and Song Garden participation in one brain.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-gray-300">
            {crowdsourceMarketingAgent.operatingPrinciples.map((principle) => (
              <li key={principle} className="rounded-xl border border-gray-700/60 bg-[#111114] px-3 py-2">
                {principle}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
        <section className="rounded-3xl border border-gray-700/60 bg-[#18181b] p-5 sm:p-6">
          <h2 className="text-xl font-bold text-white">Create campaign kit</h2>
          <p className="mt-2 text-sm text-gray-400">
            Enter the minimum event context. The agent returns reusable launch copy, reminders, social ideas, and Song Garden prompts.
          </p>

          <div className="mt-5 space-y-4">
            <Field
              label="Event name"
              value={input.eventName}
              onChange={(value) => setField("eventName", value)}
              placeholder="Crowdsource Choir: Winter Lights"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Date"
                value={input.date}
                onChange={(value) => setField("date", value)}
                placeholder="Dec 10"
              />
              <Field
                label="Venue"
                value={input.venue}
                onChange={(value) => setField("venue", value)}
                placeholder="Community Center"
              />
            </div>
            <Field
              label="Theme"
              value={input.theme}
              onChange={(value) => setField("theme", value)}
              placeholder="light, belonging, and winter memory"
            />
            <Field
              label="Audience"
              value={input.audience}
              onChange={(value) => setField("audience", value)}
              placeholder="neighbors, singers, families, immersive arts fans"
            />
            <Field
              label="Available assets"
              value={input.assets}
              onChange={(value) => setField("assets", value)}
              placeholder="rehearsal clips, crowd reactions, projection stills, testimonials"
              multiline
            />
          </div>

          <div className="mt-6 rounded-2xl border border-gray-700/60 bg-[#111114] p-4">
            <h3 className="text-sm font-semibold text-white">Song Garden logic</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              {crowdsourceMarketingAgent.songGarden.philosophy}
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Accepted contribution types</p>
            <p className="mt-1 text-sm text-gray-300">
              {crowdsourceMarketingAgent.songGarden.contributionTypes.join(", ")}
            </p>
          </div>
        </section>

        <section className="space-y-5">
          <CopyBlock
            title="Launch email"
            text={`Subject: ${campaign.launchEmail.subject}\nPreview: ${campaign.launchEmail.preview}\n\n${campaign.launchEmail.body}`}
          />
          <CopyBlock
            title="Reminder email"
            text={`Subject: ${campaign.reminderEmail.subject}\nPreview: ${campaign.reminderEmail.preview}\n\n${campaign.reminderEmail.body}`}
          />
          <CopyBlock title="Event page copy" text={`${campaign.eventPageCopy.headline}\n\n${campaign.eventPageCopy.body}\n\nCTA: ${campaign.eventPageCopy.cta}`} />

          <div className="grid gap-5 xl:grid-cols-2">
            <CopyBlock title="Social captions" text={campaign.socialCaptions.map((item, i) => `${i + 1}. ${item}`).join("\n\n")} />
            <CopyBlock title="Reel ideas" text={campaign.reelIdeas.map((item, i) => `${i + 1}. ${item}`).join("\n\n")} />
            <CopyBlock title="Ad copy" text={campaign.adCopy.map((item, i) => `${i + 1}. ${item}`).join("\n\n")} />
            <CopyBlock title="Teaser concepts" text={campaign.teaserConcepts.map((item, i) => `${i + 1}. ${item}`).join("\n\n")} />
          </div>

          <CopyBlock
            title="Posting schedule"
            text={campaign.postingSchedule.map((item) => `${item.timing}: ${item.action}`).join("\n")}
          />
        </section>
      </div>
    </div>
  );
}
