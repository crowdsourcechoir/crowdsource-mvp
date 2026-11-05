import { notFound } from "next/navigation";
import SettingsSubpage from "@/components/settings/SettingsSubpage";
import PitchEditor from "@/components/settings/PitchEditor";

export const dynamic = "force-dynamic";

export default function PitchSettingsPage({ params }: { params: { id: string } }) {
  if (!/^[a-z0-9_-]{1,80}$/.test(params.id)) notFound();

  return (
    <SettingsSubpage
      eyebrow="Pitches"
      title="Pitch"
      description="The prompt is the brief. The sections below are the live page."
      backHref="/admin/settings/pitches"
      backLabel="← Pitches"
    >
      <PitchEditor id={params.id} />
    </SettingsSubpage>
  );
}
