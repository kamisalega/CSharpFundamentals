  export type RateLimitDecision = Readonly<{
    allowed: boolean;
    remaining: number;
    retryAfterMs?: number;
  }>;

  export type RateLimiter = Readonly<{
    take(key: string): Promise<RateLimitDecision>;
  }>;

  export type TokenBucketOptions = Readonly<{
    capacity: number;
    refillTokens: number;
    refillIntervalMs: number;
    namespace?: string;
    now?: () => number;
  }>;