/** True when PostgREST/Supabase cannot see a table (never migrated or stale schema cache). */
export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { message?: string; code?: string; details?: string };
  const msg = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "PGRST205" ||
    record.code === "42P01" ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache") ||
    msg.includes("does not exist")
  );
}
