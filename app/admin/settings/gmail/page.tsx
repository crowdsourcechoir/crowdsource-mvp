import SettingsSubpage from "@/components/settings/SettingsSubpage";
import GmailSettingsClient from "@/components/settings/GmailSettingsClient";
import {
  GOOGLE_OAUTH_SCOPES,
  MAX_NUDGES_PER_OPPORTUNITY,
  NUDGE_DUE_AFTER_DAYS,
} from "@/lib/sales/gmail/constants";
import { getSettingsCard } from "@/lib/settings/catalog";

export const dynamic = "force-dynamic";

export default function GoogleConnectionsSettingsPage() {
  const card = getSettingsCard("gmail");

  return (
    <SettingsSubpage
      eyebrow="Integrations"
      title={card?.title ?? "Google connections"}
      description="Gmail outreach and Calendar meeting sync share one Google account — connect once, manage both here."
    >
      <GmailSettingsClient
        scopes={[...GOOGLE_OAUTH_SCOPES]}
        nudgeDueAfterDays={NUDGE_DUE_AFTER_DAYS}
        maxNudgesPerOpportunity={MAX_NUDGES_PER_OPPORTUNITY}
      />
    </SettingsSubpage>
  );
}
