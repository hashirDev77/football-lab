/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_MSDATA_API_KEY?: string;
  readonly VITE_MSDATA_LIVE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
