import type Redis from "ioredis";
import { RateLimiter, TokenBucketOptions, RateLimitDecision } from "./types";

const LUA_SCRIPT = `
  local key        = KEYS[1]
  local capacity   = tonumber(ARGV[1])
  local refill_pms = tonumber(ARGV[2])
  local now        = tonumber(ARGV[3])
  local cost       = tonumber(ARGV[4])
  local ttl        = tonumber(ARGV[5])

  local data   = redis.call('HMGET', key, 'tokens', 'last')
  local tokens = tonumber(data[1])
  local last   = tonumber(data[2])

  if tokens == nil then
    tokens = capacity
    last   = now
  end

  local elapsed = now - last
  if elapsed > 0 then
    tokens = math.min(capacity, tokens + elapsed * refill_pms)
    last   = now
  end

  local allowed     = 0
  local remaining   = 0
  local retry_after = 0

  if tokens >= cost then
    tokens    = tokens - cost
    allowed   = 1
    remaining = math.floor(tokens)
  else
    retry_after = math.ceil((cost - tokens) / refill_pms)
  end

  redis.call('HMSET', key, 'tokens', tokens, 'last', last)
  redis.call('PEXPIRE', key, ttl)

  return {allowed, remaining, retry_after}
  `;

export function createRedisTokenBucket(
  redis: Redis,
  opts: TokenBucketOptions,
): RateLimiter {
  const namespace = opts.namespace ?? "default";
  const refillPerMs = opts.refillTokens / opts.refillIntervalMs;
  const ttlMs = Math.ceil(2 * (opts.capacity / refillPerMs));

  return {
    async take(key: string): Promise<RateLimitDecision> {
      const redisKey = `rl:${namespace}:${key}`;
      const now = Date.now();

      const result = (await redis.eval(
        LUA_SCRIPT,
        1,
        redisKey,
        String(opts.capacity),
        String(refillPerMs),
        String(now),
        "1",
        String(ttlMs),
      )) as [number, number, number];

      const [allowed, remaining, retryAfterMs] = result;

      if (allowed === 1) {
        return { allowed: true, remaining };
      }
      return { allowed: false, remaining: 0, retryAfterMs };
    },
  };
}
