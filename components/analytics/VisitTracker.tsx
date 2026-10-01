"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

const MAX_MS = 30 * 60 * 1000;

function installGa(id: string) {
  if (document.getElementById("csc-ga")) return;
  const script = document.createElement("script");
  script.id = "csc-ga";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer || [];
  const gtag: Gtag = (...args) => {
    window.dataLayer?.push(args);
  };
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", id, { send_page_view: false });
}

export default function VisitTracker() {
  const pathname = usePathname();
  const gaId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/analytics/config", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { gaMeasurementId?: string | null }) => {
        if (cancelled || !data.gaMeasurementId) return;
        gaId.current = data.gaMeasurementId;
        installGa(data.gaMeasurementId);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/api")) return;
    const viewId = crypto.randomUUID();
    const started = performance.now();
    let lastSent = -1;

    const send = (ms: number, keepalive: boolean) => {
      const rounded = Math.max(0, Math.min(MAX_MS, Math.round(ms)));
      if (rounded === lastSent) return;
      lastSent = rounded;
      const body = JSON.stringify({
        id: viewId,
        path: pathname,
        referrer: document.referrer,
        ms: rounded,
      });
      if (keepalive && navigator.sendBeacon) {
        navigator.sendBeacon("/api/analytics/collect", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/analytics/collect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive,
        });
      }
      if (rounded === 0 && gaId.current && window.gtag) {
        window.gtag("event", "page_view", {
          page_path: pathname,
          page_title: document.title,
          send_to: gaId.current,
        });
      }
    };

    send(0, false);
    const flush = () => send(performance.now() - started, true);
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [pathname]);

  return null;
}
