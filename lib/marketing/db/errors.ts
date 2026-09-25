export class MarketingDbError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "MarketingDbError";
    this.status = status;
  }
}

const INSTALL_MESSAGE =
  "Marketing tables are not installed. Run supabase/email-marketing-tables.sql and supabase/email-marketing-rls.sql in the Supabase SQL Editor.";

export function raiseDb(error: { message?: string; code?: string } | null): void {
  if (!error) return;
  const message = error.message ?? "Database error";
  const missing =
    error.code === "42P01" ||
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    /relation .* does not exist/i.test(message) ||
    /schema cache/i.test(message) ||
    /could not find the function/i.test(message);
  if (missing) throw new MarketingDbError(INSTALL_MESSAGE, 503);
  throw new MarketingDbError(message, 500);
}
