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
      description="Turn the internal morning lead email on or off, set who receives it, and tune when it fires."
    >
      <DigestSettingsClient />
    </SettingsSubpage>
  );
}
