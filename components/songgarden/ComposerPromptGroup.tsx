import type { ReactNode } from "react";

export function personLabel(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed || "Anonymous";
}

/** Prompt headline so a group of answers is readable without opening each row. */
export function ComposerPromptHeading({
  prompt,
  count,
  noun = "answer",
}: {
  prompt: string;
  count: number;
  noun?: string;
}) {
  const label = count === 1 ? noun : `${noun}s`;
  return (
    <header>
      <p className="csc-eyebrow">Prompt</p>
      <h3 className="mt-2 text-xl font-medium leading-snug text-white">{prompt}</h3>
      <p className="mt-1 text-sm text-white/70">
        {count} {label}
      </p>
    </header>
  );
}

/** Name on its own line, then the answer, using the design-system list. */
export function ComposerAnswerRows({
  rows,
}: {
  rows: Array<{ id: string; name: string; content: string }>;
}) {
  return (
    <div className="csc-list">
      {rows.map((row) => (
        <div key={row.id} className="csc-list-row !cursor-default">
          <div className="min-w-0 w-full">
            <p className="text-sm font-semibold" style={{ color: "var(--csc-accent)" }}>
              {personLabel(row.name)}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-white">{row.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ComposerPromptSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="csc-eyebrow">{title}</h2>
      {empty ? <p className="mt-4 text-sm text-white/60">{empty}</p> : <div className="mt-6 flex flex-col gap-10">{children}</div>}
    </section>
  );
}
