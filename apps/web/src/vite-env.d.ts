/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Alamat API publik. Jangan pernah memakai awalan VITE_ untuk kunci rahasia. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
