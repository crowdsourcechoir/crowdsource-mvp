import Link from "next/link";
import { choirMedia } from "@/lib/choir-site/media";

const CHAPTERS = [
  {
    eyebrow: "We are the show",
    title: "We Are the Crowd",
    body: [
      "Not an audience. A gathering of human potential.",
      "Each person brings a voice, a presence, a pulse. Together, the room comes alive.",
    ],
    image: choirMedia.crowd1,
    alt: "A Crowdsource Choir room singing together",
    theme: "choir-theme-ink",
  },
  {
    eyebrow: "Raise the vibration",
    title: "We Are the Source",
    body: [
      "The music doesn’t arrive from elsewhere. It emerges from within.",
      "When voices rise, separation softens. Belonging returns.",
    ],
    image: choirMedia.crowd18,
    alt: "Singers close together in the choir",
    theme: "choir-theme-magenta",
  },
  {
    eyebrow: "Only here, only now",
    title: "We Are the Choir",
    body: [
      "Each voice is a unique instrument. Together, they become one.",
      "A collective sound. Alive only here, only now.",
    ],
    image: choirMedia.crowd12,
    alt: "The choir mid-song",
    theme: "choir-theme-purple",
  },
  {
    eyebrow: "Participation is the piece",
    title: "We Are the Artform",
    body: [
      "There is no performance apart from participation. No product apart from the moment itself.",
      "The ancient art of communal singing. Recovered in modernity. Recreated and experienced anew.",
    ],
    image: choirMedia.artform,
    alt: "Hands and voices in a communal sing",
    theme: "choir-theme-paper",
  },
  {
    eyebrow: "Live and co-created",
    title: "We Are the Show",
    body: [
      "Live, co-created entertainment. The room risks together.",
      "The reward is unforgettable. A shared moment of joy and unity.",
    ],
    image: choirMedia.show,
    alt: "The room in the middle of a Crowdsource Choir show",
    theme: "choir-theme-ink",
  },
  {
    eyebrow: "You leave buzzing",
    title: "We Are the Vibration",
    body: ["You arrive curious. You leave buzzing.", "The vibration rises. The soul awakens."],
    image: choirMedia.night,
    alt: "A night gathering of Crowdsource Choir",
    theme: "choir-theme-magenta",
  },
];

export function MarketingHome() {
  return (
    <>
      <section className="choir-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="choir-hero-photo" src={choirMedia.hero} alt="" />
        <div className="choir-hero-shade" />
        <p className="choir-kicker">Crowd-Driven Live Music</p>
        <div className="choir-marquee" aria-hidden="true">
          <div className="choir-display choir-marquee-track">Let’s Sing! Let’s Sing! Let’s Sing! Let’s Sing!&nbsp;</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="choir-hero-figure" src={choirMedia.heroFigure} alt="" />
        <p className="choir-hero-copy">Transforming audiences into creators through collective anthemic experiences.</p>
        <h1 className="choir-honeypot">Let’s Sing</h1>
      </section>
      {CHAPTERS.map((chapter, index) => (
        <section key={chapter.title} className={`choir-band ${chapter.theme} ${index % 2 ? "is-flip" : ""}`}>
          <div className="choir-band-copy">
            <p className="choir-eyebrow">{chapter.eyebrow}</p>
            <h2 className="choir-display">{chapter.title}</h2>
            {chapter.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={chapter.image} alt={chapter.alt} />
        </section>
      ))}
      <section className="choir-invite choir-theme-lime">
        <p className="choir-eyebrow">We are an invitation</p>
        <h2 className="choir-display">And we’re ready when you are</h2>
        <p>Bring it to your people. Raise the vibe together.</p>
        <Link className="choir-btn" href="/book">
          Book
        </Link>
      </section>
    </>
  );
}
