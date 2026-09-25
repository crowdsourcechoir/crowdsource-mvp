export type SessionCheck =
  | { state: "ok" }
  | { state: "reject" }
  | { state: "unavailable" };

/** Edge-safe session revocation check. Does not import Node crypto. */
export async function checkSessionVersion(id: string, sessionVersion: number): Promise<SessionCheck> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { state: "unavailable" };
  try {
    const res = await fetch(`${url}/rest/v1/operators?id=eq.${encodeURIComponent(id)}&select=status,session_version`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (res.status === 404) return { state: "unavailable" };
    if (!res.ok) return { state: "unavailable" };
    const rows = (await res.json()) as Array<{ status?: string; session_version?: number }>;
    const row = rows[0];
    if (!row) return { state: "reject" };
    if (row.status !== "active") return { state: "reject" };
    if (Number(row.session_version) !== sessionVersion) return { state: "reject" };
    return { state: "ok" };
  } catch {
    return { state: "unavailable" };
  }
}
