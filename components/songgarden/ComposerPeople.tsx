"use client";

import ComposerMediaCard from "@/components/songgarden/ComposerMediaCard";
import ContributionActionsMenu from "@/components/songgarden/ContributionActionsMenu";
import { isPhotoRow, type JourneySubmission } from "@/lib/composer/group-answers-by-prompt";
import { isMediaPlaceholderContent } from "@/lib/agent-interview-qa";
import { mediaSelectionId } from "@/lib/composer/selection-export";

type Props = {
  submissions: JourneySubmission[];
  selectedIds: Set<string>;
  onSelectToggle: (id: string, multi: boolean) => void;
  onDelete: (conversationId: string | undefined, turnId: string | null | undefined) => Promise<void>;
};

/** One journey at a time: the name they gave, then that person's answers and photos. */
export default function ComposerPeople({
  submissions,
  selectedIds,
  onSelectToggle,
  onDelete,
}: Props) {
  if (submissions.length === 0) {
    return <p className="text-sm text-gray-500">No responses in this scope.</p>;
  }

  return (
    <div className="border-t border-[var(--csc-row-divider)]">
      {submissions.map((person) => (
        <section key={person.key} className="border-b border-[var(--csc-row-divider)] py-5">
          <h3 className="text-base font-semibold text-white">{person.name}</h3>
          {person.answers.length > 0 ? (
            <div className="mt-3 space-y-4">
              {person.answers.map((answer) => {
                const question = answer.questionText?.trim() ?? "";
                return (
                  <div key={answer.id}>
                    {question ? <p className="text-xs text-gray-500">{question}</p> : null}
                    <div className="mt-1 flex items-start justify-between gap-3">
                      <p className="min-w-0 whitespace-pre-wrap text-sm text-gray-100">{answer.content}</p>
                      <ContributionActionsMenu
                        kindLabel="text"
                        disabled={!answer.turnId}
                        onDelete={() => onDelete(answer.conversationId, answer.turnId)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
          {person.media.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {person.media.map((item) => {
                const photo = isPhotoRow(item);
                const caption = isMediaPlaceholderContent(item.content) ? null : item.content;
                return (
                  <ComposerMediaCard
                    key={item.id}
                    url={item.videoUrl || ""}
                    asPhoto={photo}
                    participantName={person.name}
                    caption={caption}
                    selected={selectedIds.has(mediaSelectionId(item.id))}
                    onSelectToggle={(multi) => onSelectToggle(mediaSelectionId(item.id), multi)}
                    onDelete={
                      item.turnId ? () => onDelete(item.conversationId, item.turnId) : undefined
                    }
                  />
                );
              })}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}
