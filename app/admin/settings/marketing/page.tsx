import SettingsSubpage from "@/components/settings/SettingsSubpage";
import MarketingSettingsClient from "@/components/settings/MarketingSettingsClient";
import { getSettingsCard } from "@/lib/settings/catalog";

export default function MarketingSettingsPage() {
  const card = getSettingsCard("marketing");
  return (
    <SettingsSubpage
      eyebrow="Integrations"
      title={card?.title ?? "Marketing"}
      description={
        card?.description ??
        "Resend delivery, send kill switch, from identity, and acquisition ingest secrets."
      }
    >
      <MarketingSettingsClient />
    </SettingsSubpage>
  );
}
