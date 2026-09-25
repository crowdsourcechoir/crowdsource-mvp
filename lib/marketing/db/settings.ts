import { DEFAULT_MARKETING_SETTINGS, type MarketingSettings } from "../types";
import { marketingDb } from "./client";
import { raiseDb } from "./errors";

type SettingsRow = {
  sends_enabled: boolean;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  physical_address: string;
  company_name: string;
  ingest_secret: string | null;
};

function rowToSettings(row: SettingsRow): MarketingSettings {
  return {
    sendsEnabled: row.sends_enabled,
    fromName: row.from_name || DEFAULT_MARKETING_SETTINGS.fromName,
    fromEmail: row.from_email ?? "",
    replyTo: row.reply_to,
    physicalAddress: row.physical_address ?? "",
    companyName: row.company_name || DEFAULT_MARKETING_SETTINGS.companyName,
    ingestSecret: row.ingest_secret,
  };
}

export async function getMarketingSettings(): Promise<MarketingSettings> {
  const db = marketingDb();
  const { data, error } = await db.from("marketing_settings").select("*").eq("singleton", true).maybeSingle();
  raiseDb(error);
  if (!data) {
    const { data: created, error: insertError } = await db
      .from("marketing_settings")
      .insert({
        singleton: true,
        sends_enabled: false,
        from_name: DEFAULT_MARKETING_SETTINGS.fromName,
        from_email: "",
        company_name: DEFAULT_MARKETING_SETTINGS.companyName,
        physical_address: "",
      })
      .select("*")
      .single();
    raiseDb(insertError);
    return rowToSettings(created as SettingsRow);
  }
  return rowToSettings(data as SettingsRow);
}

export async function updateMarketingSettings(patch: Partial<MarketingSettings>): Promise<MarketingSettings> {
  const current = await getMarketingSettings();
  const next: MarketingSettings = {
    sendsEnabled: typeof patch.sendsEnabled === "boolean" ? patch.sendsEnabled : current.sendsEnabled,
    fromName: patch.fromName ?? current.fromName,
    fromEmail: patch.fromEmail !== undefined ? patch.fromEmail.trim() : current.fromEmail,
    replyTo: patch.replyTo !== undefined ? patch.replyTo : current.replyTo,
    physicalAddress: patch.physicalAddress ?? current.physicalAddress,
    companyName: patch.companyName ?? current.companyName,
    ingestSecret: patch.ingestSecret !== undefined ? patch.ingestSecret : current.ingestSecret,
  };
  const db = marketingDb();
  const { error } = await db
    .from("marketing_settings")
    .update({
      sends_enabled: next.sendsEnabled,
      from_name: next.fromName,
      from_email: next.fromEmail,
      reply_to: next.replyTo,
      physical_address: next.physicalAddress,
      company_name: next.companyName,
      ingest_secret: next.ingestSecret,
      updated_at: new Date().toISOString(),
    })
    .eq("singleton", true);
  raiseDb(error);
  return next;
}
