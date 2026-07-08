import OpenAI from "openai";

interface ProviderConfig {
  name: string;
  keys: string[];
  baseUrl: string;
  model: string;
  retryOnStatus: number[];
}

interface SeoOutput {
  title: string;
  description: string;
  tags: string[];
  category?: string;
}

const DEFAULT_MODELS: Record<string, string> = {
  groq: "llama-3.3-70b-versatile",
  openrouter: "deepseek/deepseek-r1-distill-llama-70b",
};

function buildProviders(): ProviderConfig[] {
  const groqKeys = (process.env.GROQ_API_KEYS || "").split(",").map(k => k.trim()).filter(Boolean);
  const openrouterKeys = (process.env.OPENROUTER_API_KEYS || "").split(",").map(k => k.trim()).filter(Boolean);

  const allProviders: ProviderConfig[] = [
    { name: "groq", keys: groqKeys, baseUrl: "https://api.groq.com/openai/v1", model: process.env.GROQ_MODEL || DEFAULT_MODELS.groq, retryOnStatus: [429, 400] },
    { name: "openrouter", keys: openrouterKeys, baseUrl: "https://openrouter.ai/api/v1", model: DEFAULT_MODELS.openrouter, retryOnStatus: [429, 400, 403, 500] },
  ];

  // Optional custom order via LLM_PROVIDER_ORDER env var
  const order = (process.env.LLM_PROVIDER_ORDER || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  if (order.length > 0) {
    const providerMap = new Map(allProviders.map(p => [p.name, p]));
    const ordered: ProviderConfig[] = [];
    for (const name of order) {
      if (providerMap.has(name)) {
        ordered.push(providerMap.get(name)!);
        providerMap.delete(name);
      }
    }
    ordered.push(...providerMap.values());
    return ordered;
  }

  return allProviders;
}

function fallbackSeo(videoTitle: string, platform: string): SeoOutput {
  return {
    title: videoTitle,
    description: `Reposted from ${platform}: ${videoTitle}`,
    tags: [],
    category: "Entertainment",
  };
}

export async function generateSeo(videoTitle: string, platform: string = "tiktok"): Promise<SeoOutput> {
  const providers = buildProviders();
  const hasAnyKey = providers.some(p => p.keys.length > 0);

  if (!hasAnyKey) {
    console.warn(`[LLM] No API keys configured — using fallback SEO`);
    return fallbackSeo(videoTitle, platform);
  }

  const prompt = `You are a YouTube SEO expert. Given the following TikTok video title, generate optimized YouTube metadata.

TikTok Title: "${videoTitle}"

Generate:
1. A click-optimized YouTube title (max 70 chars, use proper casing, add emojis if natural)
2. A compelling description (150-300 words, include relevant keywords naturally, add timestamps if applicable, end with a call to action)
3. 10-15 relevant tags (mix of broad and specific, including #shorts if under 60 seconds)
4. Best YouTube category (from: Entertainment, Education, Music, Gaming, Comedy, Howto & Style, People & Blogs, Science & Technology, Sports, News & Politics)

Respond in JSON format only:
{
  "title": "string",
  "description": "string",
  "tags": ["string"],
  "category": "string"
}`;

  for (const provider of providers) {
    if (provider.keys.length === 0) continue;

    for (let keyIdx = 0; keyIdx < provider.keys.length; keyIdx++) {
      try {
        const client = new OpenAI({ apiKey: provider.keys[keyIdx], baseURL: provider.baseUrl });
        const completion = await client.chat.completions.create({
          model: provider.model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 1024,
          response_format: { type: "json_object" },
        });
        const text = completion.choices[0]?.message?.content || "{}";
        console.log(`[LLM] ${provider.name} key ${keyIdx + 1}/${provider.keys.length} succeeded`);
        const parsed = JSON.parse(text) as SeoOutput;
        return {
          title: parsed.title || videoTitle,
          description: parsed.description || `Reposted from ${platform}: ${videoTitle}`,
          tags: parsed.tags || [],
          category: parsed.category || "Entertainment",
        };
      } catch (err: any) {
        const status = err?.status;
        if (status && provider.retryOnStatus.includes(status)) {
          console.warn(`[LLM] ${provider.name} key ${keyIdx + 1}/${provider.keys.length} failed (${status}), trying next...`);
          await sleep(500);
          continue;
        }
        console.warn(`[LLM] ${provider.name} key ${keyIdx + 1}/${provider.keys.length} non-retryable error (${status || "unknown"}): ${(err?.message || "").slice(0, 80)}`);
        break;
      }
    }
  }

  console.warn(`[LLM] All providers exhausted — using fallback SEO`);
  return fallbackSeo(videoTitle, platform);
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
