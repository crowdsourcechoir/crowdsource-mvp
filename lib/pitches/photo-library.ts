export type LibraryPhoto = {
  id: string;
  src: string;
  alt: string;
  /** Where the original frame came from. */
  source: "site" | "book";
};

/**
 * Real Crowdsource Choir photos shared by every pitch.
 * Picking one sets the slide image. It does not upload a new file.
 */
export const PHOTO_LIBRARY: readonly LibraryPhoto[] = [
  {
    id: "conductor",
    src: "/pitch/library/conductor.jpg",
    alt: "A conductor with arms raised as a room of people sings",
    source: "site",
  },
  {
    id: "audience",
    src: "/pitch/library/audience.jpg",
    alt: "A crowd singing with their hands up",
    source: "site",
  },
  {
    id: "leaders",
    src: "/pitch/library/leaders.jpg",
    alt: "Two leaders facing a room of people singing",
    source: "site",
  },
  {
    id: "hands",
    src: "/pitch/library/hands.jpg",
    alt: "People with their hands up around a singer",
    source: "site",
  },
  {
    id: "balcony",
    src: "/pitch/library/balcony.jpg",
    alt: "A full room and a band still on stage",
    source: "site",
  },
  {
    id: "band",
    src: "/pitch/library/band.jpg",
    alt: "A band performing on a small stage",
    source: "site",
  },
  {
    id: "circle",
    src: "/pitch/library/circle.jpg",
    alt: "People gathered in a circle around musicians",
    source: "site",
  },
  {
    id: "arms-wide",
    src: "/pitch/library/arms-wide.jpg",
    alt: "A leader with arms wide in a room washed in blue and green light",
    source: "site",
  },
  {
    id: "anthem",
    src: "/pitch/library/anthem.jpg",
    alt: "A musician with one hand raised in front of a singing room",
    source: "book",
  },
  {
    id: "pointing",
    src: "/pitch/library/pointing.jpg",
    alt: "A musician pointing across a dim room of people",
    source: "book",
  },
  {
    id: "drums",
    src: "/pitch/library/drums.jpg",
    alt: "A drummer and guitarist playing for a seated crowd",
    source: "book",
  },
  {
    id: "wide-crowd",
    src: "/pitch/library/wide-crowd.jpg",
    alt: "A wide room of people with their hands raised toward the stage",
    source: "book",
  },
  {
    id: "leaders-side",
    src: "/pitch/library/leaders-side.jpg",
    alt: "Two leaders on stage, one turned toward the singing room",
    source: "book",
  },
  {
    id: "piano",
    src: "/pitch/library/piano.jpg",
    alt: "A painted piano and two guitars on a lit stage",
    source: "book",
  },
] as const;

export function libraryPhoto(id: string): LibraryPhoto {
  const photo = PHOTO_LIBRARY.find((item) => item.id === id);
  if (!photo) throw new Error(`Unknown library photo: ${id}`);
  return photo;
}
