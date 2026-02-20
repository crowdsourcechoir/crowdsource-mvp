"use client";

import type { Event } from "@/data/mockEvents";
import { mockEvents } from "@/data/mockEvents";

const STORAGE_KEY = "crowdsource-custom-events";
const HIDDEN_MOCK_IDS_KEY = "crowdsource-hidden-mock-event-ids";

function getStoredEvents(): Event[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Event[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredEvents(events: Event[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // ignore
  }
}

function getHiddenMockIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HIDDEN_MOCK_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function hideMockEvent(id: string) {
  if (typeof window === "undefined") return;
  try {
    const ids = getHiddenMockIds();
    if (ids.includes(id)) return;
    ids.push(id);
    localStorage.setItem(HIDDEN_MOCK_IDS_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function getAllEvents(): Event[] {
  const hidden = getHiddenMockIds();
  const visibleMocks = mockEvents.filter((e) => !hidden.includes(e.id));
  return [...visibleMocks, ...getStoredEvents()];
}

export function getEventBySlug(slug: string): Event | undefined {
  const fromStored = getStoredEvents().find((e) => e.slug === slug);
  if (fromStored) return fromStored;
  const hidden = getHiddenMockIds();
  return mockEvents.find((e) => e.slug === slug && !hidden.includes(e.id));
}

export function getEventById(id: string): Event | undefined {
  const fromStored = getStoredEvents().find((e) => e.id === id);
  if (fromStored) return fromStored;
  const hidden = getHiddenMockIds();
  return mockEvents.find((e) => e.id === id && !hidden.includes(e.id));
}

export function addEvent(values: Omit<Event, "id">): Event {
  const id = `evt-local-${Date.now()}`;
  const event: Event = { ...values, id };
  const stored = getStoredEvents();
  stored.push(event);
  saveStoredEvents(stored);
  return event;
}

export function updateEvent(id: string, values: Partial<Omit<Event, "id">>): Event | null {
  const stored = getStoredEvents();
  const index = stored.findIndex((e) => e.id === id);
  if (index < 0) return null;
  stored[index] = { ...stored[index], ...values };
  saveStoredEvents(stored);
  return stored[index];
}

export function isStoredEvent(id: string): boolean {
  return getStoredEvents().some((e) => e.id === id);
}
