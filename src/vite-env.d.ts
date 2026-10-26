/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROXY_BASE?: string;
  readonly VITE_SPOT_REST_BASE?: string;
  readonly VITE_SPOT_WS_BASE?: string;
  readonly VITE_FUTURES_REST_BASE?: string;
  readonly VITE_FUTURES_WS_BASE?: string;
  readonly VITE_ALPHA_REST_BASE?: string;
  readonly VITE_ALPHA_POLL_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
