import { DEFAULT_EMAIL_TOKENS, resolveEmailTokens, type EmailDesignTokens } from "../render/tokens";
import { marketingDb } from "./client";
import { raiseDb } from "./errors";

export type EmailDesignRecord = {
  id: string;
  name: string;
  tokens: EmailDesignTokens;
};

export async function getDefaultDesignSystem(): Promise<EmailDesignRecord> {
  const db = marketingDb();
  const { data, error } = await db.from("email_design_systems").select("id, name, tokens").eq("is_default", true).maybeSingle();
  raiseDb(error);
  if (data?.id) {
    const row = data as { id: string; name: string; tokens: unknown };
    return { id: String(row.id), name: row.name, tokens: resolveEmailTokens(row.tokens) };
  }
  const { data: created, error: insertError } = await db
    .from("email_design_systems")
    .insert({ name: "Default", is_default: true, tokens: DEFAULT_EMAIL_TOKENS })
    .select("id, name, tokens")
    .single();
  raiseDb(insertError);
  const row = created as { id: string; name: string; tokens: unknown };
  return { id: String(row.id), name: row.name, tokens: resolveEmailTokens(row.tokens) };
}

export async function updateDefaultDesignTokens(raw: unknown): Promise<EmailDesignRecord> {
  const current = await getDefaultDesignSystem();
  const tokens = resolveEmailTokens(raw);
  const db = marketingDb();
  const { error } = await db
    .from("email_design_systems")
    .update({ tokens, updated_at: new Date().toISOString() })
    .eq("id", current.id);
  raiseDb(error);
  return { ...current, tokens };
}
