// Modified by f00700f for the community-maintained LazyCat distribution, 2026.
import daemonPackage from "../../packages/daemon/package.json";

export interface MachineVersionState {
  status?: string;
  daemonVersion?: string;
}

export const DAEMON_TARBALL_FILENAME = `${daemonPackage.name.replace(/^@/, "").replace("/", "-")}-${daemonPackage.version}.tgz`;

function cleanOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

export function daemonPackageUrl(origin: string): string {
  return `${cleanOrigin(origin)}/downloads/${DAEMON_TARBALL_FILENAME}`;
}

export function isDaemonUpdateAvailable(machine: MachineVersionState | null | undefined, latestDaemonVersion: string): boolean {
  return !!machine
    && machine.status === "online"
    && !!machine.daemonVersion
    && !!latestDaemonVersion
    && machine.daemonVersion !== latestDaemonVersion;
}

export function daemonUpdateCommandTemplate(origin: string): string {
  const serverUrl = cleanOrigin(origin);
  return `npx --yes --package="${daemonPackageUrl(serverUrl)}" -- open-tag-daemon --server-url "${serverUrl}" --api-key <your_sk_machine_key>`;
}

// The runnable connect command with a real machine key filled in (the connect-computer wizard has the
// freshly-minted key; daemonUpdateCommandTemplate keeps a placeholder for the key-not-shown update flow).
export function daemonConnectCommand(origin: string, key: string): string {
  const serverUrl = cleanOrigin(origin);
  return `npx --yes --package="${daemonPackageUrl(serverUrl)}" -- open-tag-daemon --server-url "${serverUrl}" --api-key ${key}`;
}
