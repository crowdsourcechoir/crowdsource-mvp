export type Event = {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  prompt: string;
  heroImage: string;
};

export const mockEvents: Event[] = [
  {
    id: "evt-1",
    slug: "spring-choir-2025",
    title: "Spring Choir Night",
    description: "An evening of collaborative singing and audience participation.",
    date: "2025-03-15",
    time: "19:00",
    venue: "City Hall Auditorium",
    address: "123 Main St, Downtown",
    prompt: "Share a memory or a wish in one sentence. We might turn it into a song.",
    heroImage: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800&q=80",
  },
  {
    id: "evt-2",
    slug: "summer-jam",
    title: "Summer Jam Session",
    description: "Bring your voice and your phone — we build the setlist together.",
    date: "2025-06-22",
    time: "20:00",
    venue: "Riverside Pavilion",
    address: "45 River Rd",
    prompt: "What song would you want to hear live tonight? Tell us in text or voice.",
    heroImage: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80",
  },
  {
    id: "evt-3",
    slug: "winter-lights",
    title: "Winter Lights Choir",
    description: "A participatory show for the holiday season.",
    date: "2025-12-10",
    time: "18:30",
    venue: "Community Center",
    address: "78 Oak Ave",
    prompt: "Send a short video or voice note: what does winter mean to you?",
    heroImage: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80",
  },
];

export function getEventBySlug(slug: string): Event | undefined {
  return mockEvents.find((e) => e.slug === slug);
}

export function getEventById(id: string): Event | undefined {
  return mockEvents.find((e) => e.id === id);
}
