// Added by f00700f for the community-maintained LazyCat distribution, 2026.
import type { IncomingMessage } from "node:http";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { verifyUser } from "./auth.js";
import { lazycatIdentity, matchesLazycatSession } from "./lazycatAuth.js";

/**
 * Resolve an application JWT against the current LazyCat ingress identity.
 *
 * In ordinary self-hosted deployments the JWT is sufficient. In the LazyCat build, a JWT that
 * belongs to a different microserver account is rejected, so switching the outer account cannot
 * keep using an administrator token persisted by the browser.
 */
export async function resolveUserSession(req: IncomingMessage, token: string | null): Promise<string | null> {
  const userId = verifyUser(token);
  if (!userId) return null;
  if (process.env.LAZYCAT_SSO_ENABLED !== "true") return userId;
  const identity = lazycatIdentity(req);
  if (!identity) return null;
  const user = (await db.select({
    id: schema.users.id,
    lazycatUid: schema.users.lazycatUid,
  }).from(schema.users).where(eq(schema.users.id, userId)))[0];
  return matchesLazycatSession(true, identity.uid, user?.lazycatUid ?? null) ? userId : null;
}
