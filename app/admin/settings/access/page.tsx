import SettingsSubpage from "@/components/settings/SettingsSubpage";
import PeopleAccessClient from "@/components/settings/PeopleAccessClient";

export const dynamic = "force-dynamic";

export default function AccessSettingsPage() {
  return (
    <SettingsSubpage
      eyebrow="Account"
      title="People & access"
      description="Invite collaborators, attach them to a Bloom, Song Garden, or Sales, and let them set their own password."
    >
      <PeopleAccessClient />
    </SettingsSubpage>
  );
}
