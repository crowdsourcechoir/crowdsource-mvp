import assert from "node:assert/strict";
import {
  latestLiveCorrespondent,
  parseFromHeader,
  resolveCorrespondent,
} from "./reply-correspondent";

const peggy = {
  id: "peggy",
  fullName: "Peggy Sue Loroz",
  email: "loroz@gonzaga.edu",
  normalizedEmail: "loroz@gonzaga.edu",
};
const kyle = {
  id: "kyle",
  fullName: "Kyle Hoob",
  email: "hoob@gonzaga.edu",
  normalizedEmail: "hoob@gonzaga.edu",
};
const jared = {
  id: "jared",
  fullName: "Jared Hertz",
  email: "hertzj@gonzaga.edu",
  normalizedEmail: "hertzj@gonzaga.edu",
};
const contacts = [peggy, kyle, jared];

async function main() {
  assert.deepEqual(parseFromHeader("Kyle Hoob <hoob@gonzaga.edu>"), {
    email: "hoob@gonzaga.edu",
    name: "Kyle Hoob",
  });

  const byEmail = resolveCorrespondent({
    contactId: "peggy",
    fromEmail: "hoob@gonzaga.edu",
    snippet: "Hi Joel, I appreciate the follow up",
    contacts,
  });
  assert.equal(byEmail?.contactId, "kyle");
  assert.equal(byEmail?.how, "email");

  const bySnippet = resolveCorrespondent({
    contactId: "peggy",
    fromEmail: null,
    snippet:
      "Morning, Yes, let's connect tomorrow at 11AM. Kyle Hoob Assistant Athletic Director Marketing & Creative Services",
    contacts,
  });
  assert.equal(bySnippet?.contactId, "kyle");
  assert.equal(bySnippet?.how, "snippet");

  const latest = latestLiveCorrespondent(
    [
      {
        activityType: "replied",
        occurredAt: "2026-09-03T20:40:56.000Z",
        contactId: "peggy",
        metadata: { replyKind: "live", snippet: "Hi Joel, I appreciate the follow up and apologize for the delay." },
      },
      {
        activityType: "replied",
        occurredAt: "2026-08-19T16:19:25.000Z",
        contactId: "peggy",
        metadata: {
          replyKind: "live",
          snippet: "Yes, let's connect tomorrow at 11AM. Kyle Hoob Assistant Athletic Director",
        },
      },
    ],
    contacts
  );
  assert.equal(latest?.contactId, "kyle");
  assert.equal(latest?.how, "snippet");

  const stillPeggy = resolveCorrespondent({
    contactId: "peggy",
    fromEmail: "loroz@gonzaga.edu",
    snippet: "Sharing with marketing",
    contacts,
  });
  assert.equal(stillPeggy?.contactId, "peggy");
  assert.equal(stillPeggy?.how, "email");

  console.log("reply correspondent tests passed");
}

void main();
