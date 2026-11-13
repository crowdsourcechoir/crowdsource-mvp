import assert from "node:assert/strict";
import { pitchVisitorView } from "./visitor";

const cases: Array<{
  name: string;
  live: boolean;
  hasPassword: boolean;
  owner: boolean;
  unlocked: boolean;
  view: "deck" | "password" | "unavailable";
}> = [
  {
    name: "hidden password pitch asks for the password",
    live: false,
    hasPassword: true,
    owner: false,
    unlocked: false,
    view: "password",
  },
  {
    name: "correct password opens a hidden pitch",
    live: false,
    hasPassword: true,
    owner: false,
    unlocked: true,
    view: "deck",
  },
  {
    name: "owner of a hidden password pitch still types it",
    live: false,
    hasPassword: true,
    owner: true,
    unlocked: false,
    view: "password",
  },
  {
    name: "hidden pitch with no password stays dark",
    live: false,
    hasPassword: false,
    owner: false,
    unlocked: false,
    view: "unavailable",
  },
  {
    name: "owner can preview a hidden pitch",
    live: false,
    hasPassword: false,
    owner: true,
    unlocked: false,
    view: "deck",
  },
  {
    name: "live password pitch asks for the password",
    live: true,
    hasPassword: true,
    owner: false,
    unlocked: false,
    view: "password",
  },
  {
    name: "live password pitch opens after unlock",
    live: true,
    hasPassword: true,
    owner: false,
    unlocked: true,
    view: "deck",
  },
  {
    name: "live public pitch opens",
    live: true,
    hasPassword: false,
    owner: false,
    unlocked: false,
    view: "deck",
  },
];

for (const item of cases) {
  assert.equal(
    pitchVisitorView({
      live: item.live,
      hasPassword: item.hasPassword,
      owner: item.owner,
      unlocked: item.unlocked,
    }),
    item.view,
    item.name
  );
}

console.log("pitch visitor tests ok");
