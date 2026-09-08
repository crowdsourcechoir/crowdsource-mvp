import assert from "node:assert/strict";
import { apiErrorFromBody, publicErrorMessage } from "./http-error";

async function main() {
  assert.equal(publicErrorMessage(new Error("Queue item already decided.")), "Queue item already decided.");
  assert.equal(publicErrorMessage("Error: Queue item already decided."), "Queue item already decided.");
  assert.equal(publicErrorMessage(new Error("Error: Queue item already decided.")), "Queue item already decided.");

  // Mimic Find more contacts client path: API body → throw Error → display
  const fromApi = apiErrorFromBody({ error: publicErrorMessage(new Error("Queue item already decided.")) }, "fail");
  assert.equal(fromApi, "Queue item already decided.");
  assert.equal(publicErrorMessage(new Error(fromApi)), "Queue item already decided.");

  assert.equal(publicErrorMessage({ error: "Need a website" }), "Need a website");
  assert.equal(publicErrorMessage(null, "fallback"), "fallback");

  console.log("http-error tests passed");
}

void main();
