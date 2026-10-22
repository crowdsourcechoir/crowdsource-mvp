import { supabaseAdmin } from "../../supabase-server";
import { MarketingDbError } from "./errors";

export function marketingDb() {
  if (!supabaseAdmin) {
    throw new MarketingDbError(
      "Database not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      503
    );
  }
  return supabaseAdmin;
}
