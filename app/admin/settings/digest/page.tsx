import SettingsSubpage from "@/components/settings/SettingsSubpage";
import DigestSettingsClient from "@/components/settings/DigestSettingsClient";
import { getSettingsCard } from "@/lib/settings/catalog";

export const dynamic = "force-dynamic";

export default function DigestSettingsPage() {
  const card = getSettingsCard("digest");

  return (
    <SettingsSubpage
      eyebrow="Integrations"
      title={card?.title ?? "Daily digest"}
      description="Internal morning email of organization leads — conference orgs only for now (one per org), target count default 10."
    >
      <DigestSettingsClient />
    </SettingsSubpage>
  );
}
