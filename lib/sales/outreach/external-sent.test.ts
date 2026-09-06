import assert from "node:assert/strict";
import { EXTERNAL_SENT_BODY, EXTERNAL_SENT_SUBJECT, isExternalSentDraft, placeholderSentDraft } from "./external-sent";

async function main() {
  const placeholder = placeholderSentDraft({ opportunityId: "o1", contactId: "c1", nowIso: "2026-09-06T12:00:00.000Z" });
  assert.equal(placeholder.aiSubject, EXTERNAL_SENT_SUBJECT);
  assert.equal(placeholder.aiBody, EXTERNAL_SENT_BODY);
  assert.equal(isExternalSentDraft(placeholder), true);
  assert.equal(
    isExternalSentDraft({
      aiSubject: "Crowdsource Choir for Gonzaga",
      aiBody: "Hi Kyle, ...",
    }),
    false
  );
  assert.equal(isExternalSentDraft(null), false);
  console.log("external sent draft tests passed");
}

void main();
