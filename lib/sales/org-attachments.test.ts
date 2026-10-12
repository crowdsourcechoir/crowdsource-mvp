import assert from "node:assert/strict";
import {
  isAllowedOrgAttachmentFile,
  normalizeHttpUrl,
  orgAttachmentStoragePath,
  parseOrgAttachments,
  withOrgAttachments,
} from "./org-attachments";

function main() {
  const parsed = parseOrgAttachments({
    attachments: [
      {
        id: "a1",
        kind: "link",
        url: "https://docs.google.com/document/d/abc",
        label: "Brief",
        createdAt: "2026-10-12T00:00:00.000Z",
      },
      {
        id: "a2",
        kind: "file",
        fileName: "deck.key",
        contentType: "application/x-iwork-keynote-sffkey",
        sizeBytes: 1200,
        storagePath: "sales-org-attachments/org/a2-deck.key",
        createdAt: "2026-10-12T00:00:00.000Z",
      },
      { id: "bad", kind: "link", url: "ftp://nope", label: "x", createdAt: "2026-10-12T00:00:00.000Z" },
    ],
  });
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].kind, "link");
  assert.equal(parsed[1].kind, "file");

  assert.ok(isAllowedOrgAttachmentFile("pitch.pdf", "application/pdf"));
  assert.ok(isAllowedOrgAttachmentFile("show.key", "application/octet-stream"));
  assert.ok(isAllowedOrgAttachmentFile("slides.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"));
  assert.equal(isAllowedOrgAttachmentFile("virus.exe", "application/x-msdownload"), false);

  assert.equal(normalizeHttpUrl("docs.google.com/x"), "https://docs.google.com/x");
  assert.equal(normalizeHttpUrl("https://drive.google.com/file/d/1"), "https://drive.google.com/file/d/1");
  assert.equal(normalizeHttpUrl("not a url"), null);

  const path = orgAttachmentStoragePath("org1", "att1", "My Deck.key");
  assert.equal(path, "sales-org-attachments/org1/att1-My-Deck.key");

  const meta = withOrgAttachments({ operatorNotes: "hi" }, parsed);
  assert.equal((meta.attachments as unknown[]).length, 2);
  assert.equal(meta.operatorNotes, "hi");

  console.log("org-attachments tests passed");
}

main();
