"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { choirImage, choirMedia } from "@/lib/choir-site/media";

const PRESS = [
  {
    href: "https://www.spokesman.com/stories/2025/oct/16/a-place-for-everyone-crowdsource-choir-offers-musi/",
    label: "Spokesman-Review",
  },
  {
    href: "https://www.seattletimes.com/entertainment/music/these-seattle-drop-in-choirs-turn-strangers-into-singing-ensembles/",
    label: "The Seattle Times",
  },
  {
    href: "https://seattlerefined.com/lifestyle/find-connection-through-song-with-crowdsource-choir-seattle-everyone-is-welcome-pnw-community",
    label: "Seattle Refined",
    image: choirMedia.seattleRefined,
  },
  {
    href: "https://www.knkx.org/news/2019-04-19/no-experience-necessary-is-the-mission-of-crowdsource-choir",
    label: "KNKX",
    image: choirMedia.npr,
  },
  {
    href: "https://southseattleemerald.org/arts-culture/2019/02/21/crowdsourcing-voices-for-a-new-kind-of-community-choir",
    label: "South Seattle Emerald",
    image: choirMedia.emerald,
  },
];

const POSTS = [
  {
    href: "https://www.instagram.com/p/DeBStTqMrCz/",
    image: choirImage("1793667266679-EVROZOVYBDHVCQ39UEZD/image-asset.jpeg", 800),
    alt: "Circle of Friends retreat at IslandWood",
  },
  {
    href: "https://www.instagram.com/p/DcbzGtzhveI/",
    image: choirImage("1793667268400-H9FHLDWV6FEOAO4XNRM7/image-asset.jpeg", 800),
    alt: "Ken and Joel ready to raise the vibe",
  },
  {
    href: "https://www.instagram.com/p/Da539CvhbjD/",
    image: choirImage("1793667270407-3NWO72ZW0OWMF60TH0ZT/image-asset.jpeg", 800),
    alt: "Welcome to The Song Garden",
  },
  {
    href: "https://www.instagram.com/p/DZnB_Gog1ec/",
    image: choirImage("1793667271261-C0OO90UAN8R5FCW7JSNZ/image-asset.jpeg", 800),
    alt: "Let the Sun Shine at the Alki Bathhouse",
  },
];

export function SiteFooter() {
  return (
    <footer className="choir-footer">
      <div className="choir-press">
        {PRESS.map((item) => (
          <a key={item.href} href={item.href} target="_blank" rel="noreferrer">
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image} alt={item.label} />
            ) : (
              item.label
            )}
          </a>
        ))}
      </div>
      <div className="choir-footer-grid">
        <NewsletterForm />
        <div>
          <h2 className="choir-display" style={{ fontSize: "2.4rem", marginTop: 0 }}>
            Videos
          </h2>
          <div className="choir-videos">
            <iframe
              src="https://www.youtube.com/embed/5Mcd-2eYxKY"
              title="Your Love Keeps Lifting Me Higher and Higher by Jackie Wilson"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <iframe
              src="https://www.youtube.com/embed/x-qXmoeEGOk"
              title="Crowdsource Choir sings Can't Stop the Feeling by Justin Timberlake"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </div>
      <div className="choir-ig">
        {POSTS.map((post) => (
          <a key={post.href} href={post.href} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.image} alt={post.alt} />
          </a>
        ))}
      </div>
      <p className="choir-fine">Raising the vibration in communal flashes of magnificence</p>
      <p className="choir-fine">2026 – Crowdsource Choir. All rights reserved.</p>
    </footer>
  );
}

function NewsletterForm() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "draft">("idle");
  const [error, setError] = useState("");
  const [mailto, setMailto] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setState("sending");
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/choir/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        city: form.get("city"),
        note: form.get("note"),
        company_website: form.get("company_website"),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState("idle");
      setError(data.error || "Could not sign you up.");
      return;
    }
    if (data.delivered) {
      setState("done");
      return;
    }
    setMailto(typeof data.mailto === "string" ? data.mailto : "");
    setState("draft");
  }

  return (
    <form className="choir-form" onSubmit={onSubmit}>
      <h2 className="choir-display" style={{ fontSize: "2.4rem", margin: 0 }}>
        Sign up for email and events
      </h2>
      <label className="choir-honeypot">
        Company
        <input name="company_website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="choir-field">
        Name
        <input name="name" required autoComplete="name" />
      </label>
      <label className="choir-field">
        Email
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label className="choir-field">
        Nearest city
        <input name="city" autoComplete="address-level2" />
      </label>
      <label className="choir-field">
        Anything else?
        <input name="note" />
      </label>
      {error ? <p>{error}</p> : null}
      {state === "done" ? <p>You’re on the list. We’ll be in touch.</p> : null}
      {state === "draft" ? (
        <p>
          The list isn’t connected from this server yet.{" "}
          <a href={mailto}>Email this signup</a> and we’ll add you.
        </p>
      ) : null}
      <button className="choir-btn" type="submit" disabled={state === "sending" || state === "done"}>
        {state === "sending" ? "Sending…" : "Sign up"}
      </button>
    </form>
  );
}
