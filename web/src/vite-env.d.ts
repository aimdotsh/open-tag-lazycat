// Added by f00700f for the community-maintained LazyCat distribution, 2026.
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LAZYCAT_SSO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
