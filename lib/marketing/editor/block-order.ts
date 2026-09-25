export function insertBlock<T>(blocks: T[], block: T, dropIndex: number): T[] {
  const next = [...blocks];
  const index = Math.max(0, Math.min(Math.trunc(dropIndex), next.length));
  next.splice(index, 0, block);
  return next;
}

/** dropIndex is a slot in the current list: 0 is before the first section, length is after the last. */
export function moveBlock<T extends { id: string }>(blocks: T[], id: string, dropIndex: number): T[] {
  const from = blocks.findIndex((block) => block.id === id);
  if (from < 0) return blocks;
  const clamped = Math.max(0, Math.min(Math.trunc(dropIndex), blocks.length));
  if (clamped === from || clamped === from + 1) return blocks;
  const moving = blocks[from]!;
  const next = blocks.filter((block) => block.id !== id);
  const insertAt = clamped > from ? clamped - 1 : clamped;
  next.splice(insertAt, 0, moving);
  return next;
}
