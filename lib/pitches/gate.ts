import { createHmac } from "crypto";
import { PITCH_AUTH_COOKIE, pitchAuthToken } from "@/lib/sobeca-pitch/access";
import { SOBECA_PITCH_ID } from "@/lib/pitches/model";

export const PITCH_PAGE_COOKIE = "pitch_page_auth";

export function pitchGateCookie(pitch: { id: string; href: string; passwordHash: string }): {
  name: string;
  value: string;
  path: string;
} {
  if (pitch.id === SOBECA_PITCH_ID) {
    return {
      name: PITCH_AUTH_COOKIE,
      value: pitchAuthToken(pitch.passwordHash),
      path: "/sobeca-song-garden",
    };
  }
  return {
    name: PITCH_PAGE_COOKIE,
    value: createHmac("sha256", pitch.passwordHash).update(`pitch:${pitch.id}`).digest("hex"),
    path: pitch.href,
  };
}
