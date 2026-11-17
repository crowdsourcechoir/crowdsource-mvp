export default function SpaceTextPage({
  title,
  body,
  linkUrl,
  linkLabel,
  items,
}: {
  title: string;
  body?: string;
  linkUrl?: string | null;
  linkLabel?: string | null;
  items?: { title: string; href: string }[];
}) {
  return (
    <main className="min-h-[100dvh] bg-black px-6 py-16 text-white">
      <article className="mx-auto w-full max-w-xl">
        <img src="/sobeca-song-garden/logo.png" alt="Crowdsource Choir" className="mb-10 h-10 w-auto" />
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {body?.trim() ? <p className="mt-6 whitespace-pre-wrap text-lg leading-relaxed text-white/85">{body}</p> : null}
        {items && items.length > 0 ? (
          <ul className="mt-8 divide-y divide-white/15 border-y border-white/15">
            {items.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="block py-4 text-lg text-[#CFFF81] hover:text-white">
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {linkUrl ? (
          <a
            href={linkUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-block rounded-full border border-[#CFFF81] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#CFFF81] hover:bg-[#CFFF81] hover:text-black"
          >
            {linkLabel || "Open"}
          </a>
        ) : null}
      </article>
    </main>
  );
}
