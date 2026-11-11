import { Bricolage_Grotesque, Fraunces, Literata } from "next/font/google";
import type { LyricFontId } from "@/lib/show-slides/model";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"], display: "swap" });
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});
const literata = Literata({ subsets: ["latin"], weight: ["500", "600", "700"], display: "swap" });

export const lyricFontClass: Record<LyricFontId, string> = {
  fraunces: fraunces.className,
  bricolage: bricolage.className,
  literata: literata.className,
};
