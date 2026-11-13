import { Bebas_Neue, Space_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { AnnouncementBar, SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import "./choir-site.css";

const mono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-choir-mono",
});

const display = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-choir-display",
});

export function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <div className={`${mono.variable} ${display.variable} choir-site`}>
      <AnnouncementBar />
      <div style={{ position: "relative" }}>
        <SiteHeader />
        <main>{children}</main>
      </div>
      <SiteFooter />
    </div>
  );
}
