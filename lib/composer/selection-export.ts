/** Selection ids for Composer photos and videos. Sound clips keep their own ids. */
export function mediaSelectionId(id: string): string {
  return `media:${id}`;
}

export function uniqueZipEntry(folder: string, filename: string, used: Set<string>): string {
  const safeFolder = folder.replace(/[^\w.-]+/g, "") || "files";
  const safeName = filename.replace(/[^\w.-]+/g, "_") || "file";
  let path = `${safeFolder}/${safeName}`;
  if (!used.has(path)) {
    used.add(path);
    return path;
  }
  const dot = safeName.lastIndexOf(".");
  const base = dot > 0 ? safeName.slice(0, dot) : safeName;
  const ext = dot > 0 ? safeName.slice(dot) : "";
  let n = 2;
  while (used.has(`${safeFolder}/${base}-${n}${ext}`)) n += 1;
  path = `${safeFolder}/${base}-${n}${ext}`;
  used.add(path);
  return path;
}

export function selectionActionLabel(sounds: number, media: number): string {
  const parts: string[] = [];
  if (sounds > 0) parts.push(`${sounds} sound${sounds === 1 ? "" : "s"}`);
  if (media > 0) parts.push(`${media} video${media === 1 ? "" : "s"} or photo${media === 1 ? "" : "s"}`);
  return parts.join(" and ") || "0 items";
}
