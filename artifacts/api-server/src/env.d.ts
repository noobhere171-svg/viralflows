export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT?: string;
      NODE_ENV?: string;
      FRONTEND_URL?: string;
      DATABASE_URL?: string;
      CLERK_SECRET_KEY?: string;
      CLERK_PUBLISHABLE_KEY?: string;
      CLERK_WEBHOOK_SECRET?: string;
      STRIPE_SECRET_KEY?: string;
      STRIPE_WEBHOOK_SECRET?: string;
      STRIPE_PRICE_ID?: string;
      UPSTASH_REDIS_REST_URL?: string;
      UPSTASH_REDIS_REST_TOKEN?: string;
      S3_ACCESS_KEY?: string;
      S3_SECRET_KEY?: string;
      S3_BUCKET?: string;
      S3_ENDPOINT?: string;
      S3_REGION?: string;
      REDIS_URL?: string;
      GROQ_API_KEY?: string;
      GROQ_API_KEYS?: string;
      GROQ_MODEL?: string;
      OPENROUTER_API_KEYS?: string;
      LLM_PROVIDER_ORDER?: string;
    }
  }
}
