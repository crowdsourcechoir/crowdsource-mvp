"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { choirMedia } from "@/lib/choir-site/media";
import { useCart } from "./useCart";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/book", label: "Book" },
  { href: "/about", label: "About" },
  { href: "/merch", label: "Merch" },
];

const SOCIAL = [
  { href: "https://instagram.com/crowdsourcechoir", label: "Instagram" },
  { href: "https://facebook.com/crowdsourcechoir", label: "Facebook" },
  { href: "https://www.tiktok.com/@crowdsource.choir", label: "TikTok" },
  { href: "https://www.youtube.com/@crowdsourcechoir", label: "YouTube" },
];

export function SiteHeader() {
  const path = usePathname();
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const home = path === "/";

  useEffect(() => {
    setOpen(false);
  }, [path]);

  return (
    <>
      <header className={home ? "choir-header is-home" : "choir-header"}>
        <Link href="/" aria-label="Crowdsource Choir home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="choir-logo" src={choirMedia.logo} alt="Crowdsource Choir" />
        </Link>
        <nav className="choir-nav" aria-label="Primary">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} aria-current={current(path, link.href) ? "page" : undefined}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="choir-tools">
          <div className="choir-social">
            {SOCIAL.map((link) => (
              <a key={link.href} className="choir-icon-link" href={link.href} target="_blank" rel="noreferrer" aria-label={link.label}>
                <SocialIcon name={link.label} />
              </a>
            ))}
          </div>
          <Link className="choir-icon-link" href="/cart" aria-label={`Cart, ${count} items`}>
            <span className="choir-cart-count">Cart{count > 0 ? ` ${count}` : ""}</span>
          </Link>
          <button className="choir-menu-btn" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </header>
      {open ? (
        <div className="choir-drawer">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
          <Link href="/cart">Cart{count > 0 ? ` (${count})` : ""}</Link>
          {SOCIAL.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function AnnouncementBar() {
  const [banner, setBanner] = useState(false);
  useEffect(() => {
    setBanner(sessionStorage.getItem("csc-choir-banner") !== "off");
  }, []);
  if (!banner) return null;
  return (
    <div className="choir-banner" style={{ position: "relative" }}>
      <Link href="/book">Create your anthem. Make your moment undeniable!</Link>
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={() => {
          sessionStorage.setItem("csc-choir-banner", "off");
          setBanner(false);
        }}
      >
        ×
      </button>
    </div>
  );
}

function current(path: string, href: string) {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

function SocialIcon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true as const };
  if (name === "Instagram") {
    return (
      <svg {...common}>
        <path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm10 2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm-5 3.2A3.8 3.8 0 1 1 8.2 12 3.8 3.8 0 0 1 12 8.2zm0 1.6A2.2 2.2 0 1 0 14.2 12 2.2 2.2 0 0 0 12 9.8zM17.4 6.6a1 1 0 1 1-1 1 1 1 0 0 1 1-1z" />
      </svg>
    );
  }
  if (name === "Facebook") {
    return (
      <svg {...common}>
        <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13v-2c0-.6.4-1 1-1z" />
      </svg>
    );
  }
  if (name === "TikTok") {
    return (
      <svg {...common}>
        <path d="M14 3h3a5 5 0 0 0 3 3v3a8 8 0 0 1-3-1v6.5A5.5 5.5 0 1 1 11.5 9H14v3h-.5a2.5 2.5 0 1 0 2.5 2.5V3z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M23 12.2s0-3.2-.4-4.6c-.2-.9-.9-1.6-1.8-1.8C19.2 5.4 12 5.4 12 5.4s-7.2 0-8.8.4c-.9.2-1.6.9-1.8 1.8C1 9 1 12.2 1 12.2s0 3.2.4 4.6c.2.9.9 1.6 1.8 1.8 1.6.4 8.8.4 8.8.4s7.2 0 8.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.4.4-4.6.4-4.6zM9.8 15.5v-6.6l6.2 3.3-6.2 3.3z" />
    </svg>
  );
}
