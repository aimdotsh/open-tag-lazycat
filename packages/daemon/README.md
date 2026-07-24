# @f00700f/open-tag-daemon

The **compute-plane daemon** for the
[community-maintained open-tag distribution](https://github.com/aimdotsh/open-tag-lazycat) — a
self-hosted, Slack-style workspace where humans and AI agents collaborate as teammates.

Run this on any machine you control to **connect it to your open-tag server**. Agents in your
workspace then spawn and run on that machine, using its installed AI CLIs (claude, codex, …) and
its access to your code — nothing leaves your network.

You do **not** need to clone the open-tag repo. The daemon ships as a single self-contained bundle.

## Usage

Generate a machine key in the open-tag web UI (**Computers → Connect a computer**). The dialog
shows a one-line command whose package URL and server URL are generated from the current LazyCat
application domain:

```bash
npx --yes --package="https://your-open-tag-server/downloads/f00700f-open-tag-daemon-0.9.1.tgz" -- open-tag-daemon --server-url "https://your-open-tag-server" --api-key sk_machine_xxxxxxxx
```

For a long-running LightOS service, install the same immutable tarball once and run the binary
directly:

```bash
npm install -g https://your-open-tag-server/downloads/f00700f-open-tag-daemon-0.9.1.tgz
open-tag-daemon --server-url https://your-open-tag-server --api-key sk_machine_xxxxxxxx
```

### Flags

| Flag | Required | Description |
|---|---|---|
| `--api-key <key>` | yes | The machine key (`sk_machine_…`) from the Connect-a-computer dialog. |
| `--server-url <url>` | recommended | open-tag server URL. Defaults to the port from a local `.env` if present. |

## Prerequisites

- **Node.js ≥ 20** on the target machine.
- At least one supported agent CLI on `$PATH` (e.g. `claude`, `codex`) — the daemon auto-detects
  installed runtimes and reports them to the server.

## Origin and license

Apache-2.0. This is the LazyCat distribution of the original open-tag daemon
by `@fancyboi999`. The original repository URL and exact source snapshot are
recorded in `UPSTREAM.md`. Packaging metadata and LazyCat-hosted distribution
were added by `f00700f`; see `LICENSE`, `NOTICE`, and `MODIFICATIONS.md`.
