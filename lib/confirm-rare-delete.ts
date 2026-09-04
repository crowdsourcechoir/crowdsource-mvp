/** Two native confirms for rare destructive deletes (bloom / garden). */
export function confirmRareDelete(kind: "bloom" | "garden", title: string): boolean {
  const name = title.trim() || `this ${kind}`;
  const first =
    kind === "bloom"
      ? `Delete “${name}”? This permanently removes the bloom and its interviews, clips, and submissions. Linked gardens keep their other shows.`
      : `Delete “${name}”? This permanently removes the garden and its map, chapters, and merch records. Linked blooms are kept.`;
  if (!window.confirm(first)) return false;
  return window.confirm(`Really delete “${name}”? This cannot be undone.`);
}
