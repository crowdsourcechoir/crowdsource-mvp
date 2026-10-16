import type { Metadata } from "next";
import FieldLabClient from "@/app/lab/field/FieldLabClient";
import SettingsSubpage from "@/components/settings/SettingsSubpage";
import { getSettingsCard } from "@/lib/settings/catalog";

export const metadata: Metadata = {
  title: "Field test",
  robots: { index: false, follow: false },
};

export default function FieldTestSettingsPage() {
  const card = getSettingsCard("field-test");

  return (
    <SettingsSubpage
      eyebrow="Workspace"
      title={card?.title ?? "Field test"}
      description="Harbor Test. Live Gardens and Blooms stay as they are."
    >
      <div className="h-[calc(100dvh-12rem)] min-h-[560px] overflow-hidden border border-white/10">
        <FieldLabClient embedded />
      </div>
    </SettingsSubpage>
  );
}
