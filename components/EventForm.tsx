"use client";

import { useState, FormEvent, useEffect } from "react";
import AddressMap from "./AddressMap";

export type EventFormValues = {
  title: string;
  slug: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  prompt: string;
  heroImage: string;
};

type EventFormProps = {
  onSubmit: (values: EventFormValues) => void;
  initialValues?: Partial<EventFormValues>;
  submitLabel?: string;
};

const initialValues: EventFormValues = {
  title: "",
  slug: "",
  description: "",
  date: "",
  time: "",
  venue: "",
  address: "",
  prompt: "",
  heroImage: "",
};

const MONTH_ABBREV = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function formatDateForSlug(dateStr: string): string {
  if (!dateStr) return "";
  // Parse as local date (YYYY-MM-DD) so slug matches calendar day; avoid UTC midnight shifting to previous day
  const parts = dateStr.split("-").map(Number);
  const [, month1, day] = parts;
  if (!month1 || !day || month1 < 1 || month1 > 12) return "";
  const month = MONTH_ABBREV[month1 - 1];
  return `csc-${month}${day}`;
}

export default function EventForm({ onSubmit, initialValues: initialProp, submitLabel = "Create Event" }: EventFormProps) {
  const [values, setValues] = useState<EventFormValues>({ ...initialValues, ...initialProp });
  const [success, setSuccess] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  useEffect(() => {
    if (slugManuallyEdited || !values.date) return;
    setValues((v) => ({ ...v, slug: formatDateForSlug(values.date) }));
  }, [values.date, slugManuallyEdited]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(values);
    setSuccess(true);
  }

  function handleSlugChange(next: string) {
    setSlugManuallyEdited(true);
    setValues((v) => ({ ...v, slug: next }));
  }

  function handleHeroFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setValues((v) => ({ ...v, heroImage: reader.result as string }));
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const inputClass =
    "mt-1 block w-full rounded-xl border border-gray-700/60 bg-[#2a2a2a] px-4 py-3 text-gray-100 placeholder-gray-500 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600";
  const labelClass = "block text-sm font-semibold text-gray-300";

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-6">
      {success && (
        <div className="rounded-xl border border-green-800/60 bg-green-900/20 px-4 py-3 text-sm text-green-300">
          Event created.
        </div>
      )}
      <div>
        <label htmlFor="title" className={labelClass}>
          Title
        </label>
        <input
          id="title"
          type="text"
          value={values.title}
          onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="slug" className={labelClass}>
          Public URL
        </label>
        <div className="mt-1 flex overflow-hidden rounded-xl border border-gray-700/60 bg-[#2a2a2a]">
          <span className="flex items-center border-r border-gray-700/60 bg-[#1f1f1f] px-4 py-3 text-sm text-gray-500">
            /e/
          </span>
          <input
            id="slug"
            type="text"
            placeholder="csc-mar1 (auto from date)"
            value={values.slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-0"
          />
        </div>
      </div>
      <div>
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className={labelClass}>
            Date
          </label>
          <input
            id="date"
            type="date"
            value={values.date}
            onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))}
            className={`${inputClass} [color-scheme:dark]`}
          />
        </div>
        <div>
          <label htmlFor="time" className={labelClass}>
            Time
          </label>
          <input
            id="time"
            type="time"
            value={values.time}
            onChange={(e) => setValues((v) => ({ ...v, time: e.target.value }))}
            className={`${inputClass} [color-scheme:dark]`}
          />
        </div>
      </div>
      <div>
        <label htmlFor="venue" className={labelClass}>
          Venue
        </label>
        <input
          id="venue"
          type="text"
          value={values.venue}
          onChange={(e) => setValues((v) => ({ ...v, venue: e.target.value }))}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="address" className={labelClass}>
          Address
        </label>
        <input
          id="address"
          type="text"
          value={values.address}
          onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
          className={inputClass}
        />
        <AddressMap venue={values.venue} address={values.address} className="mt-2" />
      </div>
      <div>
        <label htmlFor="prompt" className={labelClass}>
          Prompt
        </label>
        <textarea
          id="prompt"
          rows={3}
          value={values.prompt}
          onChange={(e) => setValues((v) => ({ ...v, prompt: e.target.value }))}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="heroImage" className={labelClass}>
          Hero image
        </label>
        <p className="mt-0.5 text-xs text-gray-500">Paste a URL or upload an image.</p>
        <input
          id="heroImage"
          type="text"
          placeholder="https://…"
          value={values.heroImage}
          onChange={(e) => setValues((v) => ({ ...v, heroImage: e.target.value }))}
          className={inputClass}
        />
        <div className="mt-2 flex items-center gap-3">
          <label className="cursor-pointer rounded-xl border border-gray-600 bg-[#2a2a2a] px-4 py-3 text-sm font-medium text-gray-400 hover:bg-[#333] hover:text-gray-300">
            Upload image
            <input
              type="file"
              accept="image/*"
              onChange={handleHeroFile}
              className="hidden"
            />
          </label>
          {values.heroImage && (
            <div className="h-16 w-24 overflow-hidden rounded-xl border border-gray-700 bg-[#1f1f1f]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={values.heroImage}
                alt="Preview"
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </div>
      </div>
      <button
        type="submit"
        className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-200"
      >
        {submitLabel}
      </button>
    </form>
  );
}
