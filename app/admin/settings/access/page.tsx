import SettingsSubpage from "@/components/settings/SettingsSubpage";
import PeopleAccessClient from "@/components/settings/PeopleAccessClient";

export const dynamic = "force-dynamic";

export default function AccessSettingsPage() {
  return (
    <SettingsSubpage
      eyebrow="Account"
      title="People & access"
      description="Invite collaborators, change what they can open, and let them set their own password. Saving new grants ends their current session."
    >
      <PeopleAccessClient />
    </SettingsSubpage>
  );
}
