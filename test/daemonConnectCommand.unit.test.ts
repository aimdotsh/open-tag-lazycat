// Modified by f00700f for the community-maintained LazyCat distribution, 2026.
// Run: npx tsx --test --test-force-exit test/daemonConnectCommand.unit.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { daemonConnectCommand } from "../web/src/machineUi.ts";

test("daemonConnectCommand embeds the dynamic origin in both package and server URLs", () => {
  const cmd = daemonConnectCommand("https://x.test", "sk_machine_abc");
  assert.equal(
    cmd,
    'npx --yes --package="https://x.test/downloads/f00700f-open-tag-daemon-0.9.1.tgz" -- open-tag-daemon --server-url "https://x.test" --api-key sk_machine_abc',
  );
  assert.doesNotMatch(cmd, /npmjs|fancyboi999|@latest/);
});

test("daemonConnectCommand removes a trailing slash from the current origin", () => {
  const cmd = daemonConnectCommand("https://abc.heiyu.space/", "sk_machine_abc");
  assert.match(cmd, /https:\/\/abc\.heiyu\.space\/downloads\//);
  assert.doesNotMatch(cmd, /space\/\/downloads/);
});
