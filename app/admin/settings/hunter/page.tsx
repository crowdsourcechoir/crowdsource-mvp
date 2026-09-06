import SettingsSubpage from "@/components/settings/SettingsSubpage";
import HunterSettingsClient from "@/components/settings/HunterSettingsClient";
import { HUNTER_COST_RULES, MAX_HUNTER_VERIFY_PER_RUN } from "@/lib/sales/enrichment/policy";
import { getSettingsCard } from "@/lib/settings/catalog";

export const dynamic = "force-dynamic";

export default function HunterSettingsPage() {
  const card = getSettingsCard("hunter");

  return (
    <SettingsSubpage
      eyebrow="Integrations"
      title={card?.title ?? "Hunter enrichment"}
      description="Key status, credit balance and renewal, cost model, and find/verify behavior for the sales queue."
    >
      <HunterSettingsClient verifyCapPerRun={MAX_HUNTER_VERIFY_PER_RUN} costRules={HUNTER_COST_RULES} />
    </SettingsSubpage>
  );
}
