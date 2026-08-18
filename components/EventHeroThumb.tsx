"use client";

function usableHeroSrc(src?: string | null): string {
  if (typeof src !== "string") return "";
  const v = src.trim();
  if (!v || v.startsWith("data:")) return "";
  return v;
}

type EventHeroThumbProps = {
  src?: string | null;
  title?: string;
  className?: string;
};

/** Renders a hosted hero, or a letter placeholder — never a broken empty <img>. */
export default function EventHeroThumb({
  src,
  title,
  className = "h-full w-full object-cover",
}: EventHeroThumbProps) {
  const url = usableHeroSrc(src);
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className={className} />
    );
  }
  const letter = (title ?? "").trim().charAt(0).toUpperCase();
  return (
    <div
      className="flex h-full w-full items-center justify-center text-2xl font-semibold text-gray-500"
      aria-hidden
    >
      {letter || ""}
    </div>
  );
}
