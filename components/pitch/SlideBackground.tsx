"use client";

import type { PitchSlide } from "@/app/sobeca-song-garden/content";
import { GradedPhoto } from "@/components/pitch/GradedPhoto";

type SlideBackgroundProps = {
  slide: Pick<PitchSlide, "image" | "imageAlt" | "video" | "photoOverlay" | "photoOverlayAmount" | "photoOverlayColor">;
  className?: string;
  /** Decorative outgoing slide — hide alt text. */
  decorative?: boolean;
};

/** Full-bleed slide media: looping video when set, otherwise the graded photo. */
export function SlideBackground({ slide, className = "h-full w-full", decorative = false }: SlideBackgroundProps) {
  const alt = decorative ? "" : slide.imageAlt;
  if (slide.video) {
    return (
      <div className={`relative overflow-hidden bg-black ${className}`}>
        <GradedPhoto
          src={slide.image}
          alt={alt}
          overlay={slide.photoOverlay}
          amount={slide.photoOverlayAmount ?? 1}
          color={slide.photoOverlayColor}
          className="absolute inset-0 h-full w-full"
        />
        <video
          key={slide.video}
          className="absolute inset-0 h-full w-full object-cover"
          src={slide.video}
          poster={slide.image}
          muted
          playsInline
          autoPlay
          loop
          preload="metadata"
          aria-hidden={decorative ? true : undefined}
        />
      </div>
    );
  }

  return (
    <GradedPhoto
      src={slide.image}
      alt={alt}
      overlay={slide.photoOverlay}
      amount={slide.photoOverlayAmount ?? 1}
      color={slide.photoOverlayColor}
      className={className}
    />
  );
}
