import { siteUrl } from "../../site-url";
import { escapeHtml } from "./html";

export const CHOIR_LOGO_PATH = "/logo.png";
export const CHOIR_LOGO_ALT = "Crowdsource Choir";

export function choirLogoUrl(): string {
  return `${siteUrl()}${CHOIR_LOGO_PATH}`;
}

/** Wordmark locked to the top of every compiled email. Same file the app already serves. */
export function choirLogoMjml(background: string): string {
  const src = escapeHtml(choirLogoUrl());
  const home = escapeHtml(siteUrl());
  return `<mj-section background-color="${escapeHtml(background)}" padding="28px 20px 8px"><mj-column><mj-image src="${src}" alt="${CHOIR_LOGO_ALT}" href="${home}" width="220px" align="center" padding="0" /></mj-column></mj-section>`;
}
