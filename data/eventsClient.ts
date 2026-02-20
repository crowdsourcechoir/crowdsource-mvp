"use client";

import type { Event } from "@/data/mockEvents";

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (res.status === 404) throw new Error("NOT_FOUND");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Request failed");
  }
  return res.json();
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Request failed");
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
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Request failed");
  }
  return res.json();
}

export async function getAllEvents(): Promise<Event[]> {
  const list = await apiGet<Event[]>("/api/events");
  return Array.isArray(list) ? list : [];
}

export async function getEventBySlug(slug: string): Promise<Event | null> {
  try {
    const event = await apiGet<Event>(`/api/events?slug=${encodeURIComponent(slug)}`);
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
