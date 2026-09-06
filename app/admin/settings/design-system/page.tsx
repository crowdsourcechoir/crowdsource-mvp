"use client";

import SettingsSubpage from "@/components/settings/SettingsSubpage";
import DesignSystemControls from "@/components/settings/DesignSystemControls";
import { getSettingsCard } from "@/lib/settings/catalog";

export default function DesignSystemSettingsPage() {
  const card = getSettingsCard("design-system");

  return (
    <SettingsSubpage
      eyebrow="Workspace"
      title={card?.title ?? "Design system"}
      description={
        card?.description ??
        "Edit the shared chrome tokens. Changes apply live across admin and persist in this browser."
      }
    >
      <DesignSystemControls />
    </SettingsSubpage>
  );
}
