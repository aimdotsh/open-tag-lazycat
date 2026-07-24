// Added by f00700f for the community-maintained LazyCat distribution, 2026.
import assert from "node:assert/strict";
import test from "node:test";
import type { IncomingMessage } from "node:http";
import { lazycatEmail, lazycatHandle, lazycatIdentity } from "./lazycatAuth.js";

const req = (headers: Record<string, string>) => ({ headers }) as IncomingMessage;

test("LazyCat identity is accepted only when enabled and injected by ingress", () => {
  const old = process.env.LAZYCAT_SSO_ENABLED;
  process.env.LAZYCAT_SSO_ENABLED = "true";
  assert.deepEqual(lazycatIdentity(req({ "x-forwarded-by": "lzc-ingress", "x-hc-user-id": "admin", "x-hc-user-role": "ADMIN" })), { uid: "admin", role: "ADMIN" });
  assert.equal(lazycatIdentity(req({ "x-hc-user-id": "admin", "x-hc-user-role": "ADMIN" })), null);
  if (old === undefined) delete process.env.LAZYCAT_SSO_ENABLED;
  else process.env.LAZYCAT_SSO_ENABLED = old;
});

test("LazyCat account identifiers are stable and mention-safe", () => {
  assert.equal(lazycatEmail("张 三"), lazycatEmail("张 三"));
  assert.match(lazycatHandle("张 三"), /^lzc-[a-z0-9_-]+$/);
  assert.notEqual(lazycatEmail("alice"), lazycatEmail("Alice"));
});
