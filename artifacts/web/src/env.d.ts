/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_UPSTASH_REDIS_REST_URL: string;
  readonly VITE_UPSTASH_REDIS_REST_TOKEN: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_FILEBASE_ACCESS_KEY: string;
  readonly VITE_FILEBASE_SECRET_KEY: string;
  readonly VITE_FILEBASE_BUCKET: string;
  readonly VITE_FILEBASE_ENDPOINT: string;
  readonly VITE_GROQ_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
