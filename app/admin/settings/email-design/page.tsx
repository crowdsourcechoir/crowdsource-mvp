import SettingsSubpage from "@/components/settings/SettingsSubpage";
import EmailDesignSettingsClient from "@/components/settings/EmailDesignSettingsClient";
import { getSettingsCard } from "@/lib/settings/catalog";

export default function EmailDesignSettingsPage() {
  const card = getSettingsCard("email-design");
  return (
    <SettingsSubpage
      eyebrow="Workspace"
      title={card?.title ?? "Email design"}
      description={card?.description ?? "Type, color, and spacing for marketing mail."}
    >
      <EmailDesignSettingsClient />
    </SettingsSubpage>
  );
}
