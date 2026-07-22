"use client";

import type { Event } from "@/data/mockEvents";

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (res.status === 404) throw new Error("NOT_FOUND");
  if (!res.ok) {
    const text = await res.text();
    let message = `Request failed (${res.status})`;
    try {
      const err = text ? (JSON.parse(text) as { error?: string }) : {};
      if (err?.error && typeof err.error === "string") message = err.error;
    } catch {
      if (text && text.length < 200) message = text;
    }
    throw new Error(message);
  }
  return res.json();
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    let message = `Request failed (${res.status})`;
    try {
      const err = text ? (JSON.parse(text) as { error?: string }) : {};
      if (err?.error && typeof err.error === "string") message = err.error;
    } catch {
      if (text && text.length < 200) message = text;
    }
    throw new Error(message);
  }
  return res.json();
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = `Request failed (${res.status})`;
    try {
      const err = text ? (JSON.parse(text) as { error?: string }) : {};
      if (err?.error && typeof err.error === "string") message = err.error;
    } catch {
      if (text && text.length < 200) message = text;
    }
    throw new Error(message);
  }
  return res.json();
}

export async function getAllEvents(): Promise<Event[]> {
  const list = await apiGet<Event[]>("/api/events");
  return Array.isArray(list) ? list : [];
}

export async function getEventBySlug(slug: string): Promise<Event | null> {
  try {
    const res = await fetch(`/api/events?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (res.status === 404) throw new Error("NOT_FOUND");
    if (!res.ok) {
      const text = await res.text();
      let message = `Request failed (${res.status})`;
      try {
        const err = text ? (JSON.parse(text) as { error?: string }) : {};
        if (err?.error && typeof err.error === "string") message = err.error;
      } catch {
        if (text && text.length < 200) message = text;
      }
      throw new Error(message);
    }
    const event = await res.json();
    return event ?? null;
  } catch (e) {
    if ((e as Error).message === "NOT_FOUND") return null;
    throw e;
  }
}

export async function getEventById(id: string): Promise<Event | null> {
  try {
    const event = await apiGet<Event>(`/api/events/${encodeURIComponent(id)}`);
    return event ?? null;
  } catch (e) {
    if ((e as Error).message === "NOT_FOUND") return null;
    throw e;
  }
}

export async function addEvent(values: Omit<Event, "id">): Promise<Event> {
  return apiPost<Event>("/api/events", {
    slug: values.slug,
    title: values.title,
    description: values.description,
    date: values.date,
    time: values.time,
    venue: values.venue,
    address: values.address,
    prompt: values.prompt,
    heroImage: values.heroImage,
    heroImageMode: values.heroImageMode,
    landingHeadline: values.landingHeadline,
    landingCopy: values.landingCopy,
    ctaText: values.ctaText,
    anthemCompletionMessage: values.anthemCompletionMessage,
    agentThemeId: values.agentThemeId,
    agentBrief: values.agentBrief,
    songGardenConfig: values.songGardenConfig,
    journeySteps: values.journeySteps,
    worldConfig: values.worldConfig,
  });
}

export async function updateEvent(id: string, values: Partial<Omit<Event, "id">>): Promise<Event | null> {
  try {
    return await apiPatch<Event>(`/api/events/${encodeURIComponent(id)}`, {
      ...values,
      heroImage: values.heroImage,
    });
  } catch (e) {
    if ((e as Error).message === "NOT_FOUND") return null;
    throw e;
  }
}
