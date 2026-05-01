import { getEnv } from "@/config/env";
import { RateLimiter, TokenBucketOptions } from "./types";
import { createRedisTokenBucket } from "./redisTokenBucket";
import { getRedisClient } from "@/redis";
import { createInMemoryTokenBucket } from "./inMemoryTokenBucket";

export function createRateLimiter(opts: TokenBucketOptions): RateLimiter {
  if (getEnv().RATE_LIMIT_BACKEND === "redis") {
    return createRedisTokenBucket(getRedisClient(), opts);
  }
  return createInMemoryTokenBucket(opts);
}

export { createInMemoryTokenBucket as createTokenBucketLimiter } from "./inMemoryTokenBucket";
