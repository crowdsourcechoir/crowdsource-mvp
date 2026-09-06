import SettingsSubpage from "@/components/settings/SettingsSubpage";
import GmailSettingsClient from "@/components/settings/GmailSettingsClient";
import {
  GMAIL_SCOPES,
  MAX_NUDGES_PER_OPPORTUNITY,
  NUDGE_DUE_AFTER_DAYS,
} from "@/lib/sales/gmail/constants";
import { getSettingsCard } from "@/lib/settings/catalog";

export const dynamic = "force-dynamic";

export default function GmailSettingsPage() {
  const card = getSettingsCard("gmail");

  return (
    <SettingsSubpage
      eyebrow="Integrations"
      title={card?.title ?? "Gmail outreach"}
      description="Connect the sending inbox, pause or resume sending, sync replies, and see the nudge policy."
    >
      <GmailSettingsClient
        scopes={[...GMAIL_SCOPES]}
        nudgeDueAfterDays={NUDGE_DUE_AFTER_DAYS}
        maxNudgesPerOpportunity={MAX_NUDGES_PER_OPPORTUNITY}
      />
    </SettingsSubpage>
  );
}
