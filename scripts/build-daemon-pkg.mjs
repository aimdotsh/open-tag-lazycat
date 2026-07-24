// Modified by f00700f for the community-maintained LazyCat distribution, 2026.
// Bundle the fixed-version self-hosted daemon package served by each LazyCat installation.
// without a repo clone, node_modules, or tsx. Produces TWO self-contained ESM bundles in
// packages/daemon/dist/:
//   • cli.mjs       — the daemon entry (src/daemon/index.ts); the `open-tag-daemon` bin.
//   • agent-cli.mjs — the agent-side CLI (src/cli/index.ts) the daemon injects into each spawned
//                     agent's PATH. ensureOpenTagBin() points the wrapper at this sibling when it
//                     finds it (bundled mode), else falls back to `tsx src/cli/index.ts` (repo mode).
// Neither touches the DB; daemon's only third-party dep is `ws`, the CLI's is `commander` — both
// bundled in. ws's optional native accelerators stay external (ws falls back to pure JS).
// ESM output (not CJS) so `import.meta.url` in openTagBin.ts resolves correctly.
import { build } from "esbuild";
import { chmodSync, copyFileSync, mkdirSync, statSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "packages/daemon/dist");
mkdirSync(distDir, { recursive: true });

// ESM output makes import.meta.url work, but the bundled CJS deps (commander, ws) and node builtins are
// reached via require() — undefined in ESM. Inject a real `require` (createRequire) so esbuild's __require
// shim uses it. Every dynamic require in the graph is a node builtin (resolves) or ws's optional native
// accelerators (externalized; ws try/catches their absence) — so this banner is a complete fix.
const requireShim = "import { createRequire as __ctr } from 'node:module'; const require = __ctr(import.meta.url);";
const common = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  external: ["bufferutil", "utf-8-validate"], // ws optional native accelerators — ws works without them
  logLevel: "info",
};

// Daemon — the published bin. The source entry already has a `#!/usr/bin/env node` shebang which esbuild
// preserves on line 1 (so DON'T add another in the banner — two shebangs is a syntax error in ESM).
// chmod +x so npx / global-install run it directly.
// Inject the published package version so the daemon reports its real version to the server.
// src/daemon/index.ts reads process.env.DAEMON_VERSION; esbuild inlines it here for the bundle, and it
// falls back to "dev" when the daemon is run from source via tsx (no define).
const daemonVersion = JSON.parse(readFileSync(path.join(root, "packages/daemon/package.json"), "utf8")).version;
const daemonOut = path.join(distDir, "cli.mjs");
await build({ ...common, entryPoints: [path.join(root, "src/daemon/index.ts")], outfile: daemonOut, banner: { js: requireShim }, define: { "process.env.DAEMON_VERSION": JSON.stringify(daemonVersion) } });
chmodSync(daemonOut, 0o755);

// Agent CLI — invoked by the generated wrapper via `node agent-cli.mjs`, so no shebang needed.
const agentOut = path.join(distDir, "agent-cli.mjs");
await build({ ...common, entryPoints: [path.join(root, "src/cli/index.ts")], outfile: agentOut, banner: { js: requireShim } });

// The daemon is also distributed as a standalone tarball by the LazyCat app.
// Keep the complete Apache-2.0 license and upstream notice inside that tarball.
for (const filename of ["LICENSE", "NOTICE", "UPSTREAM.md", "MODIFICATIONS.md", "THIRD_PARTY_NOTICES.md"]) {
  copyFileSync(path.join(root, filename), path.join(root, `packages/daemon/${filename}`));
}
copyFileSync(
  path.join(root, "docs/third-party-packages.md"),
  path.join(root, "packages/daemon/THIRD_PARTY_PACKAGES.md"),
);

const kb = (f) => (statSync(f).size / 1024).toFixed(0);
console.log(`✓ built packages/daemon/dist/cli.mjs (${kb(daemonOut)} KB) + agent-cli.mjs (${kb(agentOut)} KB)`);
