import assert from "node:assert/strict";
import test from "node:test";
import { checkCompose, checkDockerfile, checkHelmWorker } from "./check-deploy.mjs";

test("the image and chart require a non-root worker and a master key", () => {
  assert.deepEqual(checkDockerfile("FROM node:22\nUSER 10001\nEXPOSE 8080\nENV NITRO_PRESET=node-server\n"), []);
  assert.ok(checkDockerfile("FROM node:18\nUSER root\n").length > 0);
  assert.deepEqual(checkCompose("MERIDIAN_MASTER_KEY\nMERIDIAN_MASTER_KEY\nMERIDIAN_MASTER_KEY\nDATABASE_URL:"), []);
  assert.deepEqual(checkHelmWorker("runAsNonRoot: true\nrunAsUser: 10001\nscripts/worker.mjs\n--experimental-strip-types\n"), []);
});
