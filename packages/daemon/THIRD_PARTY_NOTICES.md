# Third-party notices

open-tag includes and bundles third-party open-source packages. Their
copyrights remain with their respective owners. This project does not
relicense those components under Apache-2.0.

The authoritative license text for each installed package is the license file
distributed with that package. `docs/third-party-packages.md` is generated
from the three npm lockfiles and records the package name, exact locked
version, declared license, and dependency group used for this release. The
standalone daemon archive includes the same inventory as
`THIRD_PARTY_PACKAGES.md`.

Notable user-visible or runtime components include:

| Component | Use | License |
| --- | --- | --- |
| React and React DOM | Web interface | MIT |
| Vite | Web build | MIT |
| Socket.IO | Realtime transport | MIT |
| Drizzle ORM / Kit | Database access and schema management | Apache-2.0 |
| PostgreSQL client (`postgres`) | Database client | Unlicense |
| Redis client (`ioredis`) | Redis integration | MIT |
| DiceBear core | Avatar generation | MIT |
| DiceBear Notionists artwork | Default avatar artwork | CC0-1.0 |
| Lucide React | Interface icons | ISC |
| Astro | Documentation site | MIT |

Some build-only packages use MPL-2.0, LGPL-3.0-or-later, CC-BY-4.0,
BlueOak-1.0.0, Python-2.0, BSD, ISC, 0BSD, CC0-1.0, Unlicense, MIT, and
Apache-2.0 terms. Consult the generated inventory and the package license
files before redistributing a modified dependency.

The names Claude, Claude Code, Claude Tag, Codex, GitHub Copilot, Cursor,
OpenCode, Kimi, Pi, Hermes, PostgreSQL, Redis, React, and other third-party
product names are used only to describe compatibility. No affiliation,
sponsorship, or endorsement is implied.
