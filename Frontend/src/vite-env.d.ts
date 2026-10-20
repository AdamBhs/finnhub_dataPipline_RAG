/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the backend API, e.g. `http://localhost:8000`. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
