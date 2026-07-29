// Added by f00700f for the community-maintained LazyCat distribution, 2026.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { matchesLazycatSession } from "../src/server/lazycatAuth.js";

test("LazyCat application sessions are bound to the active ingress account", () => {
  assert.equal(matchesLazycatSession(false, null, null), true);
  assert.equal(matchesLazycatSession(true, "admin", "admin"), true);
  assert.equal(matchesLazycatSession(true, "child", "admin"), false);
  assert.equal(matchesLazycatSession(true, null, "admin"), false);
  assert.equal(matchesLazycatSession(true, "admin", null), false);
});

test("NORMAL LazyCat accounts are isolated from the seeded administrator workspace", () => {
  const authRoutes = fs.readFileSync(new URL("../src/server/routes-api/auth.ts", import.meta.url), "utf8");
  const manifest = fs.readFileSync(new URL("../lzc-manifest.yml", import.meta.url), "utf8");
  const store = fs.readFileSync(new URL("../web/src/store.tsx", import.meta.url), "utf8");

  assert.match(authRoutes, /if \(identity\.isAdmin \|\| user!\.id === workspace\.ownerId\)/);
  assert.match(authRoutes, /db\.delete\(schema\.channelMembers\)/);
  assert.match(authRoutes, /db\.delete\(schema\.serverMembers\)/);
  assert.match(authRoutes, /!user!\.lazycatIsolatedAt \|\| previousLazycatRole === "ADMIN"/);
  assert.match(authRoutes, /createServer\(`\$\{displayName\}'s workspace`/);
  assert.match(manifest, /LAZYCAT_SSO_ENABLED=true/);
  assert.match(store, /setInterval\(validate,\s*15_000\)/);
});
