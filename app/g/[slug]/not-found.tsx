import Link from "next/link";

export default function GardenNotFound() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4 text-center text-white"
      style={{ background: "#1a0f2d" }}
    >
      <p
        className="font-mono text-xs font-semibold uppercase tracking-widest"
        style={{ color: "#CFFF81" }}
      >
        Song Garden
      </p>
      <h1 className="mt-3 text-2xl font-semibold">Garden not found</h1>
      <p className="mt-2 max-w-sm text-sm text-white/60">
        This world may still be in draft, or the link is incorrect.
      </p>
      <Link href="/" className="mt-6 text-sm underline" style={{ color: "#CFFF81" }}>
        Home
      </Link>
    </main>
  );
}
