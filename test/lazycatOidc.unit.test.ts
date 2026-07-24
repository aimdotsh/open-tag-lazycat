// Added by f00700f for the community-maintained LazyCat distribution, 2026.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  beginLazycatOidc,
  consumeLazycatCompletion,
  setLazycatCompletion,
} from "../src/server/lazycatOidc.js";

class FakeResponse {
  headers = new Map<string, string | string[]>();
  status = 0;
  ended = false;

  getHeader(name: string) {
    return this.headers.get(name.toLowerCase());
  }

  setHeader(name: string, value: string | string[]) {
    this.headers.set(name.toLowerCase(), value);
    return this;
  }

  writeHead(status: number, headers?: Record<string, string>) {
    this.status = status;
    for (const [name, value] of Object.entries(headers ?? {})) this.setHeader(name, value);
    return this;
  }

  end() {
    this.ended = true;
    return this;
  }
}

const oidcEnv = {
  JWT_SECRET: "test-jwt-secret-that-is-long-enough",
  LAZYCAT_OIDC_ENABLED: "true",
  LAZYCAT_OIDC_ISSUER: "https://box.example/sys/oauth",
  LAZYCAT_OIDC_CLIENT_ID: "f00700f.open-tag",
  LAZYCAT_OIDC_CLIENT_SECRET: "test-client-secret",
  LAZYCAT_OIDC_AUTH_URI: "https://box.example/sys/oauth/auth",
  LAZYCAT_OIDC_TOKEN_URI: "https://box.example/sys/oauth/token",
  LAZYCAT_OIDC_USERINFO_URI: "https://box.example/sys/oauth/userinfo",
  LAZYCAT_OIDC_REDIRECT_URL: "https://open-tag.box.example/api/auth/lazycat/callback",
};

function withOidcEnv(fn: () => void): void {
  const previous = Object.fromEntries(Object.keys(oidcEnv).map((key) => [key, process.env[key]]));
  Object.assign(process.env, oidcEnv);
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("LazyCat login starts an explicit authorization-code flow with state, nonce and PKCE", () => {
  withOidcEnv(() => {
    const response = new FakeResponse();
    beginLazycatOidc(response as unknown as ServerResponse);

    assert.equal(response.status, 302);
    assert.equal(response.ended, true);
    const target = new URL(String(response.getHeader("location")));
    assert.equal(target.origin + target.pathname, oidcEnv.LAZYCAT_OIDC_AUTH_URI);
    assert.equal(target.searchParams.get("response_type"), "code");
    assert.equal(target.searchParams.get("client_id"), oidcEnv.LAZYCAT_OIDC_CLIENT_ID);
    assert.equal(target.searchParams.get("redirect_uri"), oidcEnv.LAZYCAT_OIDC_REDIRECT_URL);
    assert.ok(target.searchParams.get("state"));
    assert.ok(target.searchParams.get("nonce"));
    assert.ok(target.searchParams.get("code_challenge"));
    assert.equal(target.searchParams.get("code_challenge_method"), "S256");
    assert.match(String(response.getHeader("set-cookie")), /open_tag_oidc_flow=.*HttpOnly.*Secure.*SameSite=Lax/);
  });
});

test("OIDC completion uses a short-lived HttpOnly cookie and is consumed once", () => {
  withOidcEnv(() => {
    const response = new FakeResponse();
    setLazycatCompletion(response as unknown as ServerResponse, "user-123");
    const setCookie = (response.getHeader("set-cookie") as string[])[0]!;
    const request = { headers: { cookie: setCookie.split(";")[0] } } as IncomingMessage;
    const consumeResponse = new FakeResponse();

    assert.equal(consumeLazycatCompletion(request, consumeResponse as unknown as ServerResponse), "user-123");
    assert.match(String(consumeResponse.getHeader("set-cookie")), /open_tag_oidc_completion=.*Max-Age=0/);
  });
});

test("LazyCat build shows an authorization button and no longer silently exchanges ingress headers", () => {
  const store = fs.readFileSync(new URL("../web/src/store.tsx", import.meta.url), "utf8");
  const authPage = fs.readFileSync(new URL("../web/src/views/Auth.tsx", import.meta.url), "utf8");
  const authRoutes = fs.readFileSync(new URL("../src/server/routes-api/auth.ts", import.meta.url), "utf8");
  const manifest = fs.readFileSync(new URL("../lzc-manifest.yml", import.meta.url), "utf8");

  assert.doesNotMatch(store, /fetch\("\/api\/auth\/lazycat",\s*\{\s*method:\s*"POST"/);
  assert.match(authPage, /\/api\/auth\/lazycat\/login/);
  assert.match(authPage, /lazycatLoginButton/);
  assert.match(authPage, /lazycatCompletionRequest/);
  assert.match(authPage, /const completion = exchangeLazycatCompletion\(\)/);
  assert.doesNotMatch(authPage, /return \(\) => \{ cancelled = true; \}/);
  assert.match(manifest, /oidc_redirect_path:\s*\/api\/auth\/lazycat\/callback/);
  assert.match(manifest, /LAZYCAT_OIDC_CLIENT_ID=\$\{LAZYCAT_AUTH_OIDC_CLIENT_ID\}/);
  assert.match(authRoutes, /lazycatOidcEnabled\(\)[\s\S]*\/api\/auth\/register[\s\S]*\/api\/auth\/login/);
});
