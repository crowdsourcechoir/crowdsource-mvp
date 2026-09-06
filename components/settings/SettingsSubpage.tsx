import Link from "next/link";
import type { ReactNode } from "react";

type SettingsSubpageProps = {
  /** Small accent label under the back link (e.g. Workspace, Sales) */
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
};

/**
 * Shared chrome for every `/admin/settings/<slug>` page.
 * Do not invent alternate headers — use this shell + Design system tokens.
 */
export default function SettingsSubpage({
  eyebrow,
  title,
  description,
  children,
}: SettingsSubpageProps) {
  return (
    <div className="w-full space-y-6 text-white">
      <div>
        <Link href="/admin/settings" className="csc-link text-sm font-medium">
          ← Settings
        </Link>
        <p className="csc-eyebrow mt-4">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-gray-400">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}
