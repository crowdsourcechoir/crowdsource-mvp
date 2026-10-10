"use client";

import ContributionActionsMenu from "@/components/songgarden/ContributionActionsMenu";
import {
  answersToPersonTable,
  type ComposerAnswerRow,
} from "@/lib/composer/group-answers-by-prompt";

type Props = {
  rows: ComposerAnswerRow[];
  onDelete: (conversationId: string | undefined, turnId: string | null | undefined) => Promise<void>;
};

/** One person per row, one question per column. A dash marks a skipped answer. */
export default function ComposerTextTable({ rows, onDelete }: Props) {
  const table = answersToPersonTable(rows);
  if (table.rows.length === 0) {
    return <p className="text-sm text-gray-500">No text responses in this scope.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm text-gray-200">
        <thead>
          <tr className="border-b border-[var(--csc-row-divider)]">
            <th className="sticky left-0 bg-black px-3 py-3 align-bottom font-semibold text-white">
              Name
            </th>
            {table.columns.map((column) => (
              <th
                key={column.key}
                className="min-w-[14rem] px-3 py-3 align-bottom font-semibold text-white"
              >
                {column.prompt}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((person) => (
            <tr key={person.key} className="border-b border-[var(--csc-row-divider)] align-top">
              <th className="sticky left-0 bg-black px-3 py-4 align-top font-semibold text-white">
                {person.name}
              </th>
              {table.columns.map((column) => {
                const answers = person.cells[column.key];
                if (!answers?.length) {
                  return (
                    <td key={column.key} className="px-3 py-4 text-gray-500">
                      —
                    </td>
                  );
                }
                return (
                  <td key={column.key} className="px-3 py-4">
                    <div className="space-y-2">
                      {answers.map((answer) => (
                        <div key={answer.id} className="flex items-start justify-between gap-2">
                          <p className="min-w-0 whitespace-pre-wrap text-gray-100">{answer.content}</p>
                          <ContributionActionsMenu
                            kindLabel="text"
                            disabled={!answer.turnId}
                            onDelete={() => onDelete(answer.conversationId, answer.turnId)}
                          />
                        </div>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
