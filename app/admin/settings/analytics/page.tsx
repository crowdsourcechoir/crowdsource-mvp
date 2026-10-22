import AnalyticsSettingsClient from "@/components/settings/AnalyticsSettingsClient";
import SettingsSubpage from "@/components/settings/SettingsSubpage";
import { getSettingsCard } from "@/lib/settings/catalog";

export const dynamic = "force-dynamic";

export default function AnalyticsSettingsPage() {
  const card = getSettingsCard("analytics");
  return (
    <SettingsSubpage
      eyebrow="Audience"
      title={card?.title ?? "Analytics"}
      description="Where people are, how long they stay, and how that splits across SoBECA, Song Garden, Blooms, and Gardens."
    >
      <AnalyticsSettingsClient />
    </SettingsSubpage>
  );
}
