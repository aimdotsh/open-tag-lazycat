// Added by f00700f for the community-maintained LazyCat distribution, 2026.
import crypto from "node:crypto";
import type { IncomingMessage } from "node:http";

export interface LazycatIdentity {
  uid: string;
  role: "ADMIN" | "NORMAL";
}

const firstHeader = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

/** Read the identity injected by lzc-ingress. Direct/non-LazyCat deployments stay disabled. */
export function lazycatIdentity(req: IncomingMessage): LazycatIdentity | null {
  if (process.env.LAZYCAT_SSO_ENABLED !== "true") return null;
  if (firstHeader(req.headers["x-forwarded-by"]).toLowerCase() !== "lzc-ingress") return null;
  const uid = firstHeader(req.headers["x-hc-user-id"]).trim();
  if (!uid || uid.length > 128) return null;
  const role = firstHeader(req.headers["x-hc-user-role"]).toUpperCase() === "ADMIN" ? "ADMIN" : "NORMAL";
  return { uid, role };
}

export function matchesLazycatSession(
  enabled: boolean,
  ingressUid: string | null,
  boundUid: string | null,
): boolean {
  return !enabled || (!!ingressUid && !!boundUid && ingressUid === boundUid);
}

export function lazycatEmail(uid: string): string {
  return `lazycat.${crypto.createHash("sha256").update(uid).digest("hex").slice(0, 24)}@open-tag.local`;
}

/** Produce a stable, mention-safe handle while retaining the original UID as displayName. */
export function lazycatHandle(uid: string): string {
  const cleaned = uid.normalize("NFKC").toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36);
  const suffix = crypto.createHash("sha256").update(uid).digest("hex").slice(0, 8);
  return `lzc-${cleaned || "user"}-${suffix}`;
}
