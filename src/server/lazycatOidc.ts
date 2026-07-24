// Added by f00700f for the community-maintained LazyCat distribution, 2026.
import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import jwt from "jsonwebtoken";
import { createRemoteJWKSet, jwtVerify } from "jose";

const FLOW_COOKIE = "open_tag_oidc_flow";
const COMPLETION_COOKIE = "open_tag_oidc_completion";
const COOKIE_PATH = "/api/auth/lazycat";
const TOKEN_TIMEOUT_MS = 15_000;

interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  redirectUrl: string;
}

interface FlowClaims {
  kind: "lazycat-oidc-flow";
  state: string;
  nonce: string;
  verifier: string;
}

interface CompletionClaims {
  kind: "lazycat-oidc-completion";
  userId: string;
}

export interface LazycatOidcIdentity {
  subject: string;
  displayName: string;
  isAdmin: boolean;
}

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required when LazyCat OIDC is enabled`);
  return value;
};

const oidcConfig = (): OidcConfig => ({
  issuer: requiredEnv("LAZYCAT_OIDC_ISSUER"),
  clientId: requiredEnv("LAZYCAT_OIDC_CLIENT_ID"),
  clientSecret: requiredEnv("LAZYCAT_OIDC_CLIENT_SECRET"),
  authorizationEndpoint: requiredEnv("LAZYCAT_OIDC_AUTH_URI"),
  tokenEndpoint: requiredEnv("LAZYCAT_OIDC_TOKEN_URI"),
  userinfoEndpoint: requiredEnv("LAZYCAT_OIDC_USERINFO_URI"),
  redirectUrl: requiredEnv("LAZYCAT_OIDC_REDIRECT_URL"),
});

export const lazycatOidcEnabled = (): boolean =>
  process.env.LAZYCAT_OIDC_ENABLED === "true";

const signingSecret = (): string => requiredEnv("JWT_SECRET");

const cookieValue = (req: IncomingMessage, name: string): string | null => {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return null;
};

const appendCookie = (res: ServerResponse, value: string): void => {
  const current = res.getHeader("set-cookie");
  const cookies = current == null ? [] : Array.isArray(current) ? current.map(String) : [String(current)];
  res.setHeader("set-cookie", [...cookies, value]);
};

const setCookie = (res: ServerResponse, name: string, value: string, maxAge: number): void => {
  appendCookie(
    res,
    `${name}=${encodeURIComponent(value)}; Path=${COOKIE_PATH}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`,
  );
};

const clearCookie = (res: ServerResponse, name: string): void =>
  setCookie(res, name, "", 0);

const randomToken = (): string => crypto.randomBytes(32).toString("base64url");
const pkceChallenge = (verifier: string): string =>
  crypto.createHash("sha256").update(verifier).digest("base64url");

const safeEqual = (left: string, right: string): boolean => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const signTransient = (payload: FlowClaims | CompletionClaims, expiresIn: "10m" | "2m"): string =>
  jwt.sign(payload, signingSecret(), {
    audience: "open-tag-lazycat-oidc",
    issuer: "open-tag",
    expiresIn,
  });

const verifyTransient = <T extends FlowClaims | CompletionClaims>(token: string): T =>
  jwt.verify(token, signingSecret(), {
    audience: "open-tag-lazycat-oidc",
    issuer: "open-tag",
  }) as T;

export function beginLazycatOidc(res: ServerResponse): void {
  if (!lazycatOidcEnabled()) throw new Error("LazyCat OIDC is disabled");
  const config = oidcConfig();
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken();
  const flow = signTransient({ kind: "lazycat-oidc-flow", state, nonce, verifier }, "10m");
  setCookie(res, FLOW_COOKIE, flow, 600);

  const target = new URL(config.authorizationEndpoint);
  target.searchParams.set("response_type", "code");
  target.searchParams.set("client_id", config.clientId);
  target.searchParams.set("redirect_uri", config.redirectUrl);
  target.searchParams.set("scope", "openid profile email groups");
  target.searchParams.set("state", state);
  target.searchParams.set("nonce", nonce);
  target.searchParams.set("code_challenge", pkceChallenge(verifier));
  target.searchParams.set("code_challenge_method", "S256");
  res.writeHead(302, { location: target.toString() });
  res.end();
}

const discoveryCache = new Map<string, Promise<{ jwksUri: string }>>();
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

async function jwksFor(issuer: string): Promise<ReturnType<typeof createRemoteJWKSet>> {
  let discovery = discoveryCache.get(issuer);
  if (!discovery) {
    discovery = (async () => {
      const response = await fetch(`${issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`, {
        signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`OIDC discovery failed (${response.status})`);
      const body = await response.json() as { jwks_uri?: string };
      if (!body.jwks_uri) throw new Error("OIDC discovery did not return jwks_uri");
      return { jwksUri: body.jwks_uri };
    })();
    discoveryCache.set(issuer, discovery);
  }
  const { jwksUri } = await discovery;
  let jwks = jwksCache.get(jwksUri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUri), {
      timeoutDuration: TOKEN_TIMEOUT_MS,
    });
    jwksCache.set(jwksUri, jwks);
  }
  return jwks;
}

export async function completeLazycatOidc(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<LazycatOidcIdentity> {
  if (!lazycatOidcEnabled()) throw new Error("LazyCat OIDC is disabled");
  const config = oidcConfig();
  const rawFlow = cookieValue(req, FLOW_COOKIE);
  clearCookie(res, FLOW_COOKIE);
  if (!rawFlow) throw new Error("OIDC flow cookie is missing");

  const flow = verifyTransient<FlowClaims>(rawFlow);
  if (flow.kind !== "lazycat-oidc-flow" || !safeEqual(url.searchParams.get("state") ?? "", flow.state)) {
    throw new Error("OIDC state validation failed");
  }
  if (url.searchParams.get("error")) throw new Error("OIDC authorization was denied");
  const code = url.searchParams.get("code");
  if (!code) throw new Error("OIDC callback is missing the authorization code");

  const tokenResponse = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUrl,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code_verifier: flow.verifier,
    }),
    signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
  });
  if (!tokenResponse.ok) throw new Error(`OIDC token exchange failed (${tokenResponse.status})`);
  const tokens = await tokenResponse.json() as { access_token?: string; id_token?: string };
  if (!tokens.id_token || !tokens.access_token) throw new Error("OIDC token response is incomplete");

  const jwks = await jwksFor(config.issuer);
  const verified = await jwtVerify(tokens.id_token, jwks, {
    issuer: config.issuer.replace(/\/+$/, ""),
    audience: config.clientId,
  });
  if (typeof verified.payload.nonce !== "string" || !safeEqual(verified.payload.nonce, flow.nonce)) {
    throw new Error("OIDC nonce validation failed");
  }

  let claims = verified.payload as Record<string, unknown>;
  const idTokenSubject = typeof claims.sub === "string" ? claims.sub : "";
  if (!Array.isArray(claims.groups) || (!claims.preferred_username && !claims.email && !claims.name)) {
    const userInfoResponse = await fetch(config.userinfoEndpoint, {
      headers: { authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });
    if (!userInfoResponse.ok) throw new Error(`OIDC userinfo failed (${userInfoResponse.status})`);
    const userInfo = await userInfoResponse.json() as Record<string, unknown>;
    if (typeof userInfo.sub !== "string" || !safeEqual(userInfo.sub, idTokenSubject)) {
      throw new Error("OIDC userinfo subject does not match the ID Token");
    }
    claims = { ...claims, ...userInfo };
  }

  const subject = typeof claims.sub === "string" ? claims.sub.trim() : "";
  if (!subject) throw new Error("OIDC subject is missing");
  const displayName = [claims.preferred_username, claims.email, claims.name]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0)
    ?.trim() ?? subject;
  const groups = Array.isArray(claims.groups) ? claims.groups : [];
  const isAdmin = groups.some((group) => typeof group === "string" && group.toUpperCase() === "ADMIN");
  return { subject, displayName, isAdmin };
}

export function setLazycatCompletion(res: ServerResponse, userId: string): void {
  const completion = signTransient({ kind: "lazycat-oidc-completion", userId }, "2m");
  setCookie(res, COMPLETION_COOKIE, completion, 120);
}

export function consumeLazycatCompletion(req: IncomingMessage, res: ServerResponse): string | null {
  const raw = cookieValue(req, COMPLETION_COOKIE);
  clearCookie(res, COMPLETION_COOKIE);
  if (!raw) return null;
  try {
    const completion = verifyTransient<CompletionClaims>(raw);
    return completion.kind === "lazycat-oidc-completion" ? completion.userId : null;
  } catch {
    return null;
  }
}
