import { supabaseAdmin } from "@/lib/supabase-server";

/** Every sales-platform DB access goes through this — same service-role-only pattern as the rest of the app. */
export function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error("Database not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return supabaseAdmin;
}
