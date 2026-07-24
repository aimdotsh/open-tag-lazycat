// Modified by f00700f for the community-maintained LazyCat distribution, 2026.
// Auto-extracted from the former routes-api.ts monolith — bodies are verbatim.
import type { BaseCtx, UserCtx } from "./ctx.js";
import { and, eq, or } from "drizzle-orm";
import { db, schema } from "../../db/index.js";
import { devLoginEnabled, hashPassword, isValidEmail, passwordError, safeEqual, setupToken, signUser, verifyPassword } from "../auth.js";
import { DESC_TOO_LONG, createServer, descTooLong } from "../core.js";
import { REGISTER_RATE_LIMIT, REGISTER_RATE_WINDOW_MS, clientIp, rateLimit } from "../ratelimit.js";
import { readJson, sendErr, sendJson } from "../util.js";
import { lazycatEmail, lazycatHandle, lazycatIdentity } from "../lazycatAuth.js";
import {
  beginLazycatOidc,
  completeLazycatOidc,
  consumeLazycatCompletion,
  lazycatOidcEnabled,
  setLazycatCompletion,
} from "../lazycatOidc.js";

interface LazycatAccountIdentity {
  subject: string;
  displayName: string;
  isAdmin: boolean;
}

async function provisionLazycatAccount(identity: LazycatAccountIdentity) {
  const email = lazycatEmail(identity.subject);
  const displayName = identity.displayName.slice(0, 128);
  let user = (await db.select().from(schema.users).where(eq(schema.users.email, email)))[0];
  // Migrate accounts created by the previous ingress-header bridge. That implementation keyed
  // the synthetic email by username; OIDC correctly keys it by the stable `sub` claim.
  if (!user && identity.displayName !== identity.subject) {
    const legacyEmail = lazycatEmail(identity.displayName);
    const legacyUser = (await db.select().from(schema.users).where(eq(schema.users.email, legacyEmail)))[0];
    if (legacyUser) {
      [user] = await db.update(schema.users).set({ email, displayName }).where(eq(schema.users.id, legacyUser.id)).returning();
    }
  }
  const workspace = (await db.select().from(schema.servers).where(eq(schema.servers.slug, "open-tag")))[0];
  if (!workspace) throw new Error("workspace not initialized");

  // The first LazyCat administrator claims the passwordless seed owner. This preserves seeded
  // foreign keys and avoids leaving an inaccessible synthetic owner behind.
  if (!user && identity.isAdmin) {
    const owner = (await db.select().from(schema.users).where(eq(schema.users.id, workspace.ownerId)))[0];
    if (owner?.email === "you@open-tag.local" && !owner.passwordHash) {
      [user] = await db.update(schema.users).set({
        name: lazycatHandle(identity.subject), displayName, email,
      }).where(eq(schema.users.id, owner.id)).returning();
    }
  }
  if (!user) {
    [user] = await db.insert(schema.users).values({
      name: lazycatHandle(identity.subject), displayName, email,
    }).returning();
  }

  const membership = (await db.select().from(schema.serverMembers).where(and(
    eq(schema.serverMembers.serverId, workspace.id), eq(schema.serverMembers.userId, user!.id),
  )))[0];
  const desiredRole = user!.id === workspace.ownerId ? "owner" : identity.isAdmin ? "admin" : "member";
  if (!membership) {
    await db.insert(schema.serverMembers).values({ serverId: workspace.id, userId: user!.id, role: desiredRole });
  } else if (membership.role !== "owner" && membership.role !== desiredRole) {
    await db.update(schema.serverMembers).set({ role: desiredRole }).where(and(
      eq(schema.serverMembers.serverId, workspace.id), eq(schema.serverMembers.userId, user!.id),
    ));
  }
  const all = (await db.select().from(schema.channels).where(and(
    eq(schema.channels.serverId, workspace.id), eq(schema.channels.name, "all"),
  )))[0];
  if (all) await db.insert(schema.channelMembers).values({
    channelId: all.id, memberType: "user", memberId: user!.id,
  }).onConflictDoNothing();
  return user!;
}

export async function handlePublicAuth(ctx: BaseCtx): Promise<boolean> {
  const { req, res, url, method, p } = ctx;

  // ---- auth ----
  // Full LazyCat OIDC authorization-code flow. Unlike the legacy header bridge below, this
  // starts only after an explicit click on the login page and displays LazyCat's authorization UI.
  if (p === "/api/auth/lazycat/login" && method === "GET") {
    if (!lazycatOidcEnabled()) return (sendErr(res, 404, "not found"), true);
    try {
      beginLazycatOidc(res);
    } catch {
      res.writeHead(302, { location: "/login?lazycat_error=unavailable" });
      res.end();
    }
    return true;
  }
  if (p === "/api/auth/lazycat/callback" && method === "GET") {
    if (!lazycatOidcEnabled()) return (sendErr(res, 404, "not found"), true);
    try {
      const identity = await completeLazycatOidc(req, res, url);
      const user = await provisionLazycatAccount(identity);
      setLazycatCompletion(res, user.id);
      res.writeHead(302, { location: "/login?lazycat=complete" });
      res.end();
    } catch {
      res.writeHead(302, { location: "/login?lazycat_error=authorization_failed" });
      res.end();
    }
    return true;
  }
  if (p === "/api/auth/lazycat/complete" && method === "POST") {
    if (!lazycatOidcEnabled()) return (sendErr(res, 404, "not found"), true);
    const userId = consumeLazycatCompletion(req, res);
    if (!userId) return (sendErr(res, 401, "LazyCat authorization expired", { code: "auth_lazycat_expired" }), true);
    const user = (await db.select().from(schema.users).where(eq(schema.users.id, userId)))[0];
    if (!user) return (sendErr(res, 401, "LazyCat account unavailable", { code: "auth_lazycat_account_unavailable" }), true);
    return (sendJson(res, 200, {
      token: signUser(user.id),
      user: { id: user.id, name: user.name, displayName: user.displayName, email: user.email },
    }), true);
  }

  // LazyCat store builds use OIDC as the only human sign-in path. Keep the
  // upstream password/bootstrap endpoints unavailable even to users who have
  // already passed platform ingress, so role mapping cannot be bypassed by
  // calling an otherwise hidden local endpoint directly.
  if (lazycatOidcEnabled() && [
    "/api/auth/dev-login",
    "/api/auth/setup",
    "/api/auth/register",
    "/api/auth/login",
  ].includes(p)) {
    return (sendErr(res, 404, "not found"), true);
  }

  // LazyCat passwordless login: lzc-ingress authenticates the browser and injects the user identity.
  // This route is not public_path, so unauthenticated callers never reach it with trusted headers.
  if (p === "/api/auth/lazycat" && method === "POST") {
    const identity = lazycatIdentity(req);
    if (!identity) return (sendErr(res, 404, "not found"), true);
    let user;
    try {
      user = await provisionLazycatAccount({
        subject: identity.uid,
        displayName: identity.uid,
        isAdmin: identity.role === "ADMIN",
      });
    } catch {
      return (sendErr(res, 503, "workspace not initialized"), true);
    }
    return (sendJson(res, 200, {
      token: signUser(user.id),
      user: { id: user.id, name: user.name, displayName: user.displayName, email: user.email },
    }), true);
  }

  // Dev-login: public username→JWT shortcut for local development ONLY. Gated behind ALLOW_DEV_LOGIN (default off),
  // so production never exposes it. When disabled it 404s — indistinguishable from a non-existent route (no endpoint leak).
  if (p === "/api/auth/dev-login" && method === "POST") {
    if (!devLoginEnabled()) return (sendErr(res, 404, "not found"), true);
    const b = await readJson(req);
    const name = String(b.name ?? "you").trim();
    if (!name || name.length > 64) return (sendErr(res, 400, "invalid name"), true);
    let u = (await db.select().from(schema.users).where(eq(schema.users.name, name)))[0];
    if (!u) [u] = await db.insert(schema.users).values({ name, displayName: name, email: `${name}@dev.local` }).returning();
    // Multi-tenant: each user has isolated data — ensure the user has their own server (creates an empty one if absent, zero channels/agents; "you" owns the seeded default workspace)
    const mine = (await db.select().from(schema.servers).where(eq(schema.servers.ownerId, u!.id)))[0];
    if (!mine) await createServer(`${name}'s workspace`, `u-${u!.id.slice(0, 8)}`, u!.id);
    if (!u) return (sendErr(res, 500, "dev-login failed"), true);
    return (sendJson(res, 200, { token: signUser(u!.id), user: { id: u!.id, name: u!.name, displayName: u!.displayName } }), true);
  }
  // First-deploy admin setup: one-time, token-gated. Disabled (404) unless ADMIN_SETUP_TOKEN is configured.
  // First-run guard: only initializes the seeded default-workspace owner while it still has no password — so it
  // self-closes (410) once an admin password exists. This unblocks the seeded "you" admin after dev-login is turned off,
  // without ever hard-coding a default password. Placed BEFORE the auth gate (the operator has no JWT yet).
  if (p === "/api/auth/setup" && method === "POST") {
    const tok = setupToken();
    if (!tok) return (sendErr(res, 404, "not found"), true);
    const rl = rateLimit("auth:setup", clientIp(req), 5);
    if (!rl.ok) return (sendErr(res, 429, "too many requests", { retryAfter: rl.retryAfter }), true);
    const b = await readJson(req);
    if (!safeEqual(String(b.token ?? ""), tok)) return (sendErr(res, 403, "invalid setup token"), true);
    const ws = (await db.select().from(schema.servers).where(eq(schema.servers.slug, "open-tag")))[0];
    if (!ws) return (sendErr(res, 409, "no default workspace; run seed first"), true);
    const admin = (await db.select().from(schema.users).where(eq(schema.users.id, ws.ownerId)))[0];
    if (!admin) return (sendErr(res, 409, "default workspace owner missing"), true);
    if (admin.passwordHash) return (sendErr(res, 410, "already initialized"), true);
    const pwErr = passwordError(b.password);
    if (pwErr) return (sendErr(res, 400, pwErr), true);
    const patch: Record<string, unknown> = { passwordHash: hashPassword(String(b.password)) };
    if (b.email !== undefined) {
      if (!isValidEmail(b.email)) return (sendErr(res, 400, "invalid email"), true);
      if (b.email !== admin.email) {
        const dup = (await db.select().from(schema.users).where(eq(schema.users.email, b.email)))[0];
        if (dup) return (sendErr(res, 409, "email already in use"), true);
        patch.email = b.email;
      }
    }
    if (typeof b.displayName === "string" && b.displayName.trim()) patch.displayName = b.displayName.trim();
    await db.update(schema.users).set(patch).where(eq(schema.users.id, admin.id));
    return (sendJson(res, 200, { token: signUser(admin.id), user: { id: admin.id, name: admin.name, email: (patch.email as string) ?? admin.email } }), true);
  }
  if (p === "/api/auth/register" && method === "POST") {
    const rl = rateLimit("auth:register", clientIp(req), REGISTER_RATE_LIMIT, REGISTER_RATE_WINDOW_MS);
    if (!rl.ok) return (sendErr(res, 429, "too many registrations from this IP — please try again later", { code: "auth_rate_limited", retryAfter: rl.retryAfter }), true);
    const b = await readJson(req);
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name || name.length > 64) return (sendErr(res, 400, "invalid name", { code: "auth_register_name_invalid" }), true);
    if (!isValidEmail(b.email)) return (sendErr(res, 400, "invalid email", { code: "auth_email_invalid" }), true);
    const pwErr = passwordError(b.password);
    if (pwErr) return (sendErr(res, 400, pwErr, { code: "auth_password_invalid" }), true);
    const dup = (await db.select().from(schema.users).where(or(eq(schema.users.email, b.email), eq(schema.users.name, name))))[0];
    if (dup) return (sendErr(res, 409, dup.email === b.email ? "email already registered" : "username already taken", { code: dup.email === b.email ? "auth_register_email_taken" : "auth_register_username_taken" }), true);
    const [u] = await db.insert(schema.users).values({ name, displayName: typeof b.displayName === "string" && b.displayName.trim() ? b.displayName.trim() : name, email: b.email, passwordHash: hashPassword(String(b.password)) }).returning();
    await createServer(`${name}'s workspace`, `u-${u!.id.slice(0, 8)}`, u!.id); // Create personal workspace on registration (aligned with dev-login; without it, entering the app with no server causes bootstrap to crash)
    return (sendJson(res, 200, { token: signUser(u!.id), user: { id: u!.id, name: u!.name } }), true);
  }
  // Login: return stable, user-actionable error codes. This intentionally distinguishes an unknown email from a
  // wrong password for self-hosted workspace UX; the endpoint remains rate-limited to reduce enumeration/brute-force abuse.
  if (p === "/api/auth/login" && method === "POST") {
    const rl = rateLimit("auth:login", clientIp(req));
    if (!rl.ok) return (sendErr(res, 429, "too many requests", { code: "auth_rate_limited", retryAfter: rl.retryAfter }), true);
    const b = await readJson(req);
    if (typeof b.email !== "string" || typeof b.password !== "string" || !b.email.trim() || !b.password.trim()) return (sendErr(res, 400, "email and password required", { code: "auth_login_fields_required" }), true);
    if (!isValidEmail(b.email)) return (sendErr(res, 400, "invalid email", { code: "auth_email_invalid" }), true);
    const u = (await db.select().from(schema.users).where(eq(schema.users.email, b.email)))[0];
    if (!u) return (sendErr(res, 404, "email not found", { code: "auth_login_email_not_found" }), true);
    if (!verifyPassword(b.password, u.passwordHash)) return (sendErr(res, 401, "password incorrect", { code: "auth_login_password_wrong" }), true);
    return (sendJson(res, 200, { token: signUser(u.id), user: { id: u.id, name: u.name } }), true);
  }
  // Invite info (public, no auth required): the /join/:token landing page uses this to display "X invited you to join workspace Y"
  if (p === "/api/auth/invite-info" && method === "GET") {
    const token = url.searchParams.get("token") ?? "";
    const link = token ? (await db.select().from(schema.joinLinks).where(eq(schema.joinLinks.token, token)))[0] : undefined;
    if (!link) return (sendJson(res, 200, { valid: false }), true);
    const expired = !!link.expiresAt && new Date(link.expiresAt as any).getTime() < Date.now();
    const exhausted = link.maxUses != null && link.useCount >= link.maxUses;
    const srv = (await db.select().from(schema.servers).where(eq(schema.servers.id, link.serverId)))[0];
    const inviter = link.createdByUserId ? (await db.select().from(schema.users).where(eq(schema.users.id, link.createdByUserId)))[0] : null;
    return (sendJson(res, 200, { valid: !expired && !exhausted && !!srv, serverName: srv?.name, serverSlug: srv?.slug, inviterName: inviter?.displayName || inviter?.name || null, role: link.role }), true);
  }
  return false;
}

export async function handleAuthedAuth(ctx: UserCtx): Promise<boolean> {
  const { req, res, method, p, userId } = ctx;
  // Accept invite (requires auth): join a workspace via a join-link token. Idempotent.
  if (p === "/api/auth/accept-invite" && method === "POST") {
    const b = await readJson(req);
    const link = b.token ? (await db.select().from(schema.joinLinks).where(eq(schema.joinLinks.token, String(b.token))))[0] : undefined;
    if (!link) return (sendErr(res, 404, "invalid invite"), true);
    if (link.expiresAt && new Date(link.expiresAt as any).getTime() < Date.now()) return (sendErr(res, 410, "invite expired"), true);
    if (link.maxUses != null && link.useCount >= link.maxUses) return (sendErr(res, 410, "invite exhausted"), true);
    const srv = (await db.select().from(schema.servers).where(eq(schema.servers.id, link.serverId)))[0];
    if (!srv) return (sendErr(res, 404, "server gone"), true);
    const existing = (await db.select().from(schema.serverMembers).where(and(eq(schema.serverMembers.serverId, link.serverId), eq(schema.serverMembers.userId, userId))))[0];
    if (!existing) {
      await db.insert(schema.serverMembers).values({ serverId: link.serverId, userId, role: link.role });
      await db.update(schema.joinLinks).set({ useCount: link.useCount + 1 }).where(eq(schema.joinLinks.id, link.id));
      const all = (await db.select().from(schema.channels).where(and(eq(schema.channels.serverId, link.serverId), eq(schema.channels.name, "all"))))[0];
      if (all) await db.insert(schema.channelMembers).values({ channelId: all.id, memberType: "user", memberId: userId }).onConflictDoNothing();
    }
    return (sendJson(res, 200, { serverSlug: srv.slug, serverId: srv.id, already: !!existing }), true);
  }

  if (p === "/api/auth/me" && method === "GET") {
    const u = (await db.select().from(schema.users).where(eq(schema.users.id, userId)))[0];
    return (u ? sendJson(res, 200, { id: u.id, name: u.name, displayName: u.displayName, email: u.email, description: u.description, avatarUrl: u.avatarUrl }) : sendErr(res, 404, "not found"), true);
  }
  if (p === "/api/auth/me" && method === "PATCH") {
    const b = await readJson(req); const patch: Record<string, unknown> = {};
    if (descTooLong(b.description)) return (sendErr(res, 400, DESC_TOO_LONG), true);
    for (const k of ["displayName", "description", "avatarUrl"]) if (b[k] !== undefined) patch[k] = b[k];
    if (Object.keys(patch).length) await db.update(schema.users).set(patch).where(eq(schema.users.id, userId));
    const u = (await db.select().from(schema.users).where(eq(schema.users.id, userId)))[0];
    return (sendJson(res, 200, { id: u!.id, name: u!.name, displayName: u!.displayName, email: u!.email, description: u!.description }), true);
  }
  return false;
}
