import Link from "next/link";
import type { ReactNode } from "react";

type SettingsSubpageProps = {
  /** Small accent label under the back link (e.g. Workspace, Sales) */
  eyebrow: string;
  title: string;
  description?: string;
  /** Sits at the upper right of the header, beside the title. */
  actions?: ReactNode;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
};

/**
 * Shared chrome for every `/admin/settings/<slug>` page.
 * Do not invent alternate headers — use this shell + Design system tokens.
 */
export default function SettingsSubpage({
  eyebrow,
  title,
  description,
  actions,
  children,
  backHref = "/admin/settings",
  backLabel = "← Settings",
}: SettingsSubpageProps) {
  return (
    <div className="w-full space-y-6 text-white">
      <div>
        <Link href={backHref} className="csc-link text-sm font-medium">
          {backLabel}
        </Link>
        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="csc-eyebrow">{eyebrow}</p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{title}</h1>
            {description ? <p className="mt-2 max-w-2xl text-sm text-gray-400">{description}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </div>
      {children}
    </div>
  );
}
