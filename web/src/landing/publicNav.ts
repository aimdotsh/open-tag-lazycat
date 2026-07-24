// Modified by f00700f for the community-maintained LazyCat distribution, 2026.
export const GITHUB_URL = "https://github.com/aimdotsh/open-tag-lazycat";
export const MARKETING_SITE_URL = "";
export const DOCS_SITE_URL = "/docs/";
export const PUBLIC_BRAND_MARK_SRC = "/favicon.svg";

export const MARKETING_ORIGINS = new Set<string>();

export type PublicNavLinkKey = "features" | "capabilities" | "engines" | "selfHosted" | "docs";

export type PublicNavLink = {
  key: PublicNavLinkKey;
  label: string;
  marketingHref: string;
};

export const PUBLIC_NAV_LINKS: PublicNavLink[] = [
  { key: "features", label: "Features", marketingHref: "/features" },
  { key: "capabilities", label: "Capabilities", marketingHref: "/#capabilities" },
  { key: "engines", label: "Engines", marketingHref: "/#engines" },
  { key: "selfHosted", label: "Self-hosted", marketingHref: "/#self-hosted" },
  { key: "docs", label: "Docs", marketingHref: "/docs/" },
];

export function resolveDocsHref(origin = MARKETING_SITE_URL): string {
  const base = origin.replace(/\/+$/, "");
  return base ? `${base}/docs/` : DOCS_SITE_URL;
}

export function resolveMarketingHomeHref(origin = MARKETING_SITE_URL): string {
  const base = origin.replace(/\/+$/, "");
  return base ? `${base}/` : "/";
}

export function resolvePublicNavHref(link: PublicNavLink, origin = MARKETING_SITE_URL, surface: "marketing" | "docs" = "marketing"): string {
  if (surface === "marketing") return link.key === "docs" ? resolveDocsHref(origin) : link.marketingHref;
  if (link.key === "docs") return "#top";
  if (!origin) return link.marketingHref;
  const home = resolveMarketingHomeHref(origin);
  return new URL(link.marketingHref, home).toString();
}
