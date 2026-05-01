import type {
  RateLimiter,
  RateLimitDecision,
  TokenBucketOptions,
} from "./types";

type Bucket = { tokens: number; lastRefillAt: number };

export function createInMemoryTokenBucket(
  opts: TokenBucketOptions,
): RateLimiter {
  const now = opts.now ?? (() => Date.now());
  const buckets = new Map<string, Bucket>();
  const refillRatePerMs = opts.refillTokens / opts.refillIntervalMs;

  function refill(b: Bucket, t: number): void {
    const elapsed = t - b.lastRefillAt;
    if (elapsed <= 0) return;
    b.tokens = Math.min(opts.capacity, b.tokens + elapsed * refillRatePerMs);
    b.lastRefillAt = t;
  }

  return {
    async take(key: string): Promise<RateLimitDecision> {
      const t = now();
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { tokens: opts.capacity, lastRefillAt: t };
        buckets.set(key, bucket);
      }

      refill(bucket, t);

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return { allowed: true, remaining: Math.floor(bucket.tokens) };
      }
      return { allowed: false, remaining: 0 };
    },
  };
}
