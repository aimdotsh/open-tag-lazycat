# Community modifications

Copyright 2026 f00700f contributors.

This file provides a prominent distribution-level record of changes made to
the upstream open-tag source snapshot described in `UPSTREAM.md`. Source files
whose formats support comments also carry a short modification notice.
Machine-readable JSON and generated files are covered by this record and by
the repository history.

## LazyCat MicroServer distribution

- Added LPK V2 package, manifest, build configuration, icon, immutable registry
  image references, persistent PostgreSQL/Redis/application storage, stable
  installation secrets, health checks, and startup dependency handling.
- Added LazyCat OIDC authorization-code login, callback validation, account
  mapping, and a dedicated sign-in/consent user experience.
- Disabled production development login and retained the existing human,
  agent, and daemon authentication boundaries.
- Added dynamic current-origin generation for daemon connection commands so
  every LazyCat installation uses its own domain.

## Self-hosted daemon distribution

- Renamed the community daemon package to
  `@f00700f/open-tag-daemon@0.9.1`.
- Added a fixed-version tarball served by the application at
  `/downloads/f00700f-open-tag-daemon-0.9.1.tgz`.
- Replaced runtime use of the original npm namespace and floating `latest`
  version with a pinned `npx --package=<installation URL>` command.
- Added `LICENSE`, `NOTICE`, and this modification record to the daemon
  distribution.

## Documentation and governance

- Added LazyCat/LightOS installation, security, persistence, and daemon
  operating instructions in Chinese and English.
- Replaced operational links to the unavailable upstream repository with the
  community-maintained repository while retaining the original address for
  provenance.
- Added third-party component/license inventory and community security
  reporting information.

## Modified source and configuration areas

The distribution changes include, but are not limited to:

- `Dockerfile.lazycat`
- `package.yml`, `lzc-manifest.yml`, `lzc-build.yml`,
  `lzc-build.dev.yml`
- `package.json`, `package-lock.json`
- `packages/daemon/**`
- `scripts/build-daemon-pkg.mjs`, `scripts/docker-entrypoint.sh`,
  `scripts/wait-for-postgres.mjs`
- `src/server/index.ts`, `src/server/routes-api/auth.ts`,
  `src/server/lazycatAuth.ts`, `src/server/lazycatOidc.ts`
- `web/src/machineUi.ts`, `web/src/routing.ts`, `web/src/store.tsx`,
  `web/src/views/Auth.tsx`, related styles and localization files
- LazyCat and daemon unit tests

See `CHANGELOG.md` and the community repository history for release-level
details.
