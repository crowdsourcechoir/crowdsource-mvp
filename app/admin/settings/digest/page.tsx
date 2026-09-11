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
      description="Internal morning lead email — sends once a day with your target count (default 10), backfilling from the queue when needed."
    >
      <DigestSettingsClient />
    </SettingsSubpage>
  );
}
