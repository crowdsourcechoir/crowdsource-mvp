"use client";

import React from "react";
import type { PitchSlide } from "@/app/sobeca-song-garden/content";
import { GradedPhoto } from "@/components/pitch/GradedPhoto";

type SlideBackgroundProps = {
  slide: Pick<PitchSlide, "image" | "imageAlt" | "video" | "photoOverlay" | "photoOverlayAmount" | "photoOverlayColor">;
  className?: string;
  /** Decorative outgoing slide — hide alt text. */
  decorative?: boolean;
};

/** Full-bleed slide media: looping video when set, otherwise the graded photo. The salmon grade applies to both. */
export function SlideBackground({ slide, className = "h-full w-full", decorative = false }: SlideBackgroundProps) {
  return (
    <GradedPhoto
      src={slide.image}
      alt={decorative ? "" : slide.imageAlt}
      video={slide.video}
      overlay={slide.photoOverlay}
      amount={slide.photoOverlayAmount ?? 1}
      color={slide.photoOverlayColor}
      className={className}
    />
  );
}
