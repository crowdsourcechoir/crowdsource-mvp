import SettingsSubpage from "@/components/settings/SettingsSubpage";
import SalesOffersSettingsClient from "@/components/settings/SalesOffersSettingsClient";
import { getSettingsCard } from "@/lib/settings/catalog";

export const dynamic = "force-dynamic";

export default function SalesOffersSettingsPage() {
  const card = getSettingsCard("sales-offers");

  return (
    <SettingsSubpage
      eyebrow="Integrations"
      title={card?.title ?? "Offers & engines"}
      description="Playbook effort mix, Premium / Partnership / Owned engines, flagship offers, and suggested package amounts for booked / cash / earned on Won deals."
    >
      <SalesOffersSettingsClient />
    </SettingsSubpage>
  );
}
