export default function PitchUnavailable({ title }: { title: string }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-black px-6 text-center text-white">
      <div>
        <img src="/sobeca-song-garden/logo.png" alt="Crowdsource Choir" className="mx-auto mb-8 h-10 w-auto" />
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-white/70">This page is not live.</p>
      </div>
    </main>
  );
}
