/** Pink grade matching the library photos that already carry a salmon duotone. */
export function GradedPhoto({
  src,
  alt,
  overlay,
  className = "",
  imgClassName = "",
}: {
  src: string;
  alt: string;
  overlay?: "salmon";
  className?: string;
  imgClassName?: string;
}) {
  const graded = overlay === "salmon";
  return (
    <span className={`relative block overflow-hidden ${className}`}>
      <img
        src={src}
        alt={alt}
        className={`h-full w-full object-cover ${graded ? "contrast-110" : ""} ${imgClassName}`}
      />
      {graded ? (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#ff4b6e] mix-blend-color" />
      ) : null}
    </span>
  );
}
