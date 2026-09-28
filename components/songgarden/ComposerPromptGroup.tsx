import type { ReactNode } from "react";

export function personLabel(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed || "Anonymous";
}

export type ComposerTableGroup = {
  key: string;
  prompt: string;
  answers: Array<{ id: string; name: string; content: string }>;
};

/**
 * Condensed table, no rules: lime prompt, white response, name.
 * The prompt is shown once per group; later rows keep the columns aligned.
 */
export function ComposerAnswerTable({ groups }: { groups: ComposerTableGroup[] }) {
  return (
    <div className="text-sm leading-snug">
      {groups.map((group) => (
        <div key={group.key} className="mt-3 first:mt-0">
          {group.answers.map((row, index) => (
            <div
              key={row.id}
              className="grid grid-cols-1 gap-x-4 py-px sm:grid-cols-[minmax(12rem,1.15fr)_minmax(0,1.7fr)_8.5rem] sm:items-baseline"
            >
              <div className="font-medium" style={{ color: "var(--csc-accent)" }}>
                {index === 0 ? group.prompt : null}
              </div>
              <div className="whitespace-pre-wrap text-white">{row.content}</div>
              <div className="text-white/80">{personLabel(row.name)}</div>
            </div>
          ))}
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
      {empty ? <p className="mt-2 text-sm text-white/60">{empty}</p> : <div className="mt-2">{children}</div>}
    </section>
  );
}
