import SettingsSubpage from "@/components/settings/SettingsSubpage";
import AutoSendSettingsClient from "@/components/settings/AutoSendSettingsClient";
import { getSettingsCard } from "@/lib/settings/catalog";

export const dynamic = "force-dynamic";

export default function AutoSendSettingsPage() {
  const card = getSettingsCard("autosend");

  return (
    <SettingsSubpage
      eyebrow="Integrations"
      title={card?.title ?? "Automated sending"}
      description="Master switch for the weekday outreach queue. The live line of sent, today, and upcoming emails is on Sales."
    >
      <AutoSendSettingsClient />
    </SettingsSubpage>
  );
}
