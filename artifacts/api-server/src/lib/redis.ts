import { Redis } from "ioredis";
import "dotenv/config";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || "";
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || "";

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(redisUrl, {
      password: redisToken,
      enableAutoPipelining: true,
      maxRetriesPerRequest: null,
    });
  }
  return redis;
}

export { getRedis };
export default getRedis;
