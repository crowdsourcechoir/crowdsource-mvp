import SettingsSubpage from "@/components/settings/SettingsSubpage";
import AutoSendSettingsClient from "@/components/settings/AutoSendSettingsClient";
import { getSettingsCard } from "@/lib/settings/catalog";

export const dynamic = "force-dynamic";

export default function AutoSendSettingsPage() {
  const card = getSettingsCard("autosend");

  return (
    <SettingsSubpage
      eyebrow="Integrations"
      title={card?.title ?? "Weekday Gmail drafts"}
      description="Master switch for the weekday outreach queue. Due slots are filed in Gmail Drafts — nothing is auto-sent."
    >
      <AutoSendSettingsClient />
    </SettingsSubpage>
  );
}
