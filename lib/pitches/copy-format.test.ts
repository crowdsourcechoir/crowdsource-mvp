import assert from "node:assert/strict";
import {
  nextUnderline,
  overlayListItem,
  parseCopyRuns,
  pitchPoint,
  sanitizeBold,
  sanitizeUnderline,
  splitLead,
  toggleBoldPhrase,
  toggleInlineMark,
} from "./copy-format";

const runs = parseCopyRuns("Make the moment undeniable.", { underline: "undeniable", bold: ["moment"] });
assert.deepEqual(
  runs.map((run) => [run.bold, run.underline, run.text]),
  [
    [false, false, "Make the "],
    [true, false, "moment"],
    [false, false, " "],
    [false, true, "undeniable"],
    [false, false, "."],
  ]
);

const marked = parseCopyRuns("Turn **your people** into the {{moment}}.");
assert.equal(marked.find((run) => run.bold)?.text, "your people");
assert.equal(marked.find((run) => run.underline)?.text, "moment");

assert.equal(sanitizeUnderline("Make the moment undeniable.", "undeniable"), "undeniable");
assert.equal(sanitizeUnderline("Make the moment undeniable.", "missing"), undefined);
assert.equal(sanitizeUnderline("Hello", false), false);
assert.deepEqual(sanitizeBold("Participation design matters", ["design", "nope", "design"]), ["design"]);

assert.deepEqual(toggleBoldPhrase(["design"], "design"), []);
assert.deepEqual(toggleBoldPhrase(["design"], "team"), ["design", "team"]);
assert.equal(nextUnderline(undefined, ""), true);
assert.equal(nextUnderline(true, ""), false);
assert.equal(nextUnderline(undefined, "undeniable"), "undeniable");
assert.equal(nextUnderline("undeniable", "undeniable"), false);

assert.equal(toggleInlineMark("hello world", 6, 11, "**", "**"), "hello **world**");
assert.equal(toggleInlineMark("hello **world**", 8, 13, "**", "**"), "hello world");

assert.deepEqual(splitLead("Participation design: Develop a custom-branded Song Garden."), {
  label: "Participation design",
  detail: "Develop a custom-branded Song Garden.",
});
assert.equal(splitLead("What happens when you invite them: they create."), null);
assert.equal(pitchPoint("Volunteers"), null);
assert.deepEqual(pitchPoint({ label: "Live activation", detail: "Lead the room." }), {
  label: "Live activation",
  detail: "Lead the room.",
});
assert.deepEqual(
  overlayListItem({ label: "Participation design", detail: "Keep this." }, "Participation design: A saved line.", 200),
  { label: "Participation design", detail: "A saved line." }
);
assert.equal(overlayListItem("Volunteers", "Hosts", 20), "Hosts");

console.log("copy format tests ok");
