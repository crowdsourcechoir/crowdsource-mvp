/** Two native confirms for rare destructive deletes (bloom / garden / organization). */
export function confirmRareDelete(kind: "bloom" | "garden" | "organization", title: string): boolean {
  const name = title.trim() || `this ${kind}`;
  const first =
    kind === "bloom"
      ? `Delete “${name}”? This permanently removes the bloom and its interviews, clips, and submissions. Linked gardens keep their other shows.`
      : kind === "garden"
        ? `Delete “${name}”? This permanently removes the garden and its map, chapters, and merch records. Linked blooms are kept.`
        : `Delete “${name}”? This removes the organization from the sales queue and stops further prospecting. Outreach history is kept.`;
  if (!window.confirm(first)) return false;
  return window.confirm(`Really delete “${name}”? This cannot be undone.`);
}
