export type PitchListItem = {
  name: string;
  title: string;
  prompt: string;
  href: string;
  category: string | null;
  organizationName: string | null;
};

/** "*" is every pitch. "?" is pitches with no category. Any other value is that category. */
export function pitchInCategory(category: string | null, filter: string): boolean {
  if (filter === "*") return true;
  if (filter === "?") return !category;
  return (category ?? "").localeCompare(filter, undefined, { sensitivity: "accent" }) === 0;
}

/** Case-insensitive match across the name, headline, prompt, address, category, and organization. */
export function pitchMatchesQuery(pitch: PitchListItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [pitch.name, pitch.title, pitch.prompt, pitch.href, pitch.category ?? "", pitch.organizationName ?? ""]
    .join("\n")
    .toLowerCase()
    .includes(needle);
}

/** Category labels already in use, in alphabetical order, keeping the first spelling. */
export function pitchCategoryNames(categories: Array<string | null>): string[] {
  const seen = new Map<string, string>();
  for (const category of categories) {
    const label = category?.trim();
    if (!label) continue;
    const key = label.toLocaleLowerCase();
    if (!seen.has(key)) seen.set(key, label);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
