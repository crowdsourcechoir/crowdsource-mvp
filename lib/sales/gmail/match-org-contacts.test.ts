import assert from "node:assert/strict";
import { mergeContactSuggestions } from "./contact-suggestion-store";
import { organizationAcronym, proposeOrgContacts } from "./match-org-contacts";

const ama = {
  id: "org-ama",
  name: "American Marketing Association",
  domains: ["ama.org"],
};

async function main() {
  assert.equal(organizationAcronym("American Marketing Association"), "ama");
  assert.equal(organizationAcronym("Fred Hutchinson Cancer Center"), "fhcc");

  const domainHit = proposeOrgContacts({
    people: [
      {
        email: "Jane.Doe@AMA.org",
        fullName: "Jane Doe | American Marketing Association",
        subjects: ["Next year's conference"],
      },
    ],
    organizations: [ama],
    selfEmails: ["joel@crowdsourcechoir.com"],
  });
  assert.equal(domainHit.length, 1);
  assert.equal(domainHit[0].matchHow, "domain");
  assert.equal(domainHit[0].fullName, "Jane Doe");
  assert.equal(domainHit[0].email, "jane.doe@ama.org");
  assert.match(domainHit[0].prompt, /person from the American Marketing Association/);
  assert.match(domainHit[0].prompt, /Add Jane Doe \(jane\.doe@ama\.org\)\?/);

  const subdomain = proposeOrgContacts({
    people: [{ email: "jane.doe@staff.ama.org", fullName: "Jane Doe", subjects: [] }],
    organizations: [ama],
  });
  assert.equal(subdomain[0]?.matchHow, "domain");

  const acronym = proposeOrgContacts({
    people: [{ email: "jane.doe@ama.org", fullName: null, subjects: [] }],
    organizations: [{ ...ama, domains: [] }],
  });
  assert.equal(acronym.length, 1);
  assert.equal(acronym[0].matchHow, "acronym");
  assert.equal(acronym[0].fullName, "Jane Doe");

  const ambiguous = proposeOrgContacts({
    people: [{ email: "jane.doe@ama.org", fullName: "Jane Doe", subjects: [] }],
    organizations: [
      { id: "a", name: "American Marketing Association", domains: [] },
      { id: "b", name: "Association of Marketing Administrators", domains: [] },
    ],
  });
  assert.equal(ambiguous.length, 0);

  const mention = proposeOrgContacts({
    people: [
      {
        email: "jane.doe@gmail.com",
        fullName: "Jane Doe",
        subjects: ["Re: American Marketing Association keynote"],
      },
    ],
    organizations: [ama],
  });
  assert.equal(mention.length, 1);
  assert.equal(mention[0].matchHow, "mention");

  const noMention = proposeOrgContacts({
    people: [{ email: "jane.doe@gmail.com", fullName: "Jane Doe", subjects: ["Hello"] }],
    organizations: [ama],
  });
  assert.equal(noMention.length, 0);

  const skipped = proposeOrgContacts({
    people: [
      { email: "noreply@ama.org", fullName: "AMA Notifications", subjects: [] },
      { email: "info@ama.org", fullName: null, subjects: [] },
      { email: "joel@crowdsourcechoir.com", fullName: "Joel DeJong", subjects: [] },
      { email: "jane.doe@ama.org", fullName: "Jane Doe", subjects: [] },
    ],
    organizations: [ama],
    selfEmails: ["joel@crowdsourcechoir.com"],
    skipDomains: ["crowdsourcechoir.com"],
    takenKeys: new Set(["org-ama:jane.doe@ama.org"]),
  });
  assert.equal(skipped.length, 0);

  const nameLine = proposeOrgContacts({
    people: [{ email: "pat@fredhutch.org", fullName: "Pat Lee", subjects: [] }],
    organizations: [{ id: "fh", name: "Fred Hutchinson Cancer Center", domains: [] }],
  });
  assert.equal(nameLine[0]?.matchHow, "name");

  const merged = mergeContactSuggestions(
    [
      {
        id: "org-ama:jane.doe@ama.org",
        organizationId: "org-ama",
        organizationName: "American Marketing Association",
        email: "jane.doe@ama.org",
        fullName: "Jane Doe",
        reason: "old",
        prompt: "old",
        matchHow: "domain",
        sampleSubject: null,
        lastSeenAt: "2026-01-01T00:00:00.000Z",
        status: "dismissed",
        contactId: null,
      },
    ],
    [
      {
        id: "org-ama:jane.doe@ama.org",
        organizationId: "org-ama",
        organizationName: "American Marketing Association",
        email: "jane.doe@ama.org",
        fullName: "Jane Doe",
        reason: "new",
        prompt: "new",
        matchHow: "domain",
        sampleSubject: "Hello",
      },
    ],
    "2026-02-01T00:00:00.000Z"
  );
  assert.equal(merged[0]?.status, "dismissed");
  assert.equal(merged[0]?.reason, "new");
  assert.equal(merged[0]?.sampleSubject, "Hello");

  console.log("match-org-contacts tests passed");
}

void main();
