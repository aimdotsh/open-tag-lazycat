# Security Policy

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
pull requests, or discussions.** A public report gives attackers a head start.

### Preferred channel — GitHub private vulnerability reporting

Use GitHub's built-in private reporting:
**Security → Report a vulnerability** on the
[community repository](https://github.com/aimdotsh/open-tag-lazycat/security/advisories/new).

This opens a confidential thread between you and the maintainers. GitHub keeps
it private until a fix is published and a CVE (if warranted) is issued.

### Fallback contact

If private reporting is unavailable, contact the community maintainer through
the contact information on the [aimdotsh GitHub profile](https://github.com/aimdotsh).
Do not include secrets or exploit details in a public issue.

Include:
- A description of the vulnerability and its potential impact.
- Steps to reproduce or a proof-of-concept (as minimal as possible).
- The version(s) affected.
- Any suggested mitigations you have in mind.

The community maintainer will acknowledge and triage reports on a best-effort
basis, keep reporters informed when possible, and credit them unless they
prefer to remain anonymous.

## Supported versions

| Version | Supported |
|---------|-----------|
| Latest `main` | Yes |
| Older tags | Best-effort (patch may land only on `main`) |

open-tag is early-stage software. We strongly recommend running the latest
community release. LazyCat installations serve their own pinned daemon tarball;
this distribution does not obtain the daemon from npmjs.com.

## Known security design decisions

- `ALLOW_DEV_LOGIN=true` mints JWTs with no password — **development only**.
  `NODE_ENV=production` disables it as a second line of defense.
- `DAEMON_BOOTSTRAP_KEY` defaults to a placeholder (`poc-secret-key`) in dev.
  Set a strong random value in `.env` before any network-accessible deployment.
- Agent tokens are per-agent `sk_agent_*` secrets hashed with bcrypt. They are
  rotated on every agent turn.

See `docs/authorization.md` for the full access-control model and known
hardening gaps.

## Out of scope

- Issues already tracked in `docs/tech-debt-tracker.md` with a `Pending` or
  `Deferred` status (unless you have a working exploit).
- Self-hosted misconfigurations (e.g. exposing the server to the internet
  without TLS or a reverse proxy).
