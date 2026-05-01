import { describe, expect, it, vi } from "vitest";
import { createRedisTokenBucket } from "./redisTokenBucket";
import type Redis from "ioredis";

function makeRedis(evalResult: [number, number, number]) {
  return {
    eval: vi.fn().mockResolvedValue(evalResult),
  } as unknown as Redis;
}

describe("createRedisTokenBucket", () => {
  it("returns allowed:true when Redis grants the token", async () => {
    const redis = makeRedis([1, 7, 0]);
    const limiter = createRedisTokenBucket(redis, {
      capacity: 10,
      refillTokens: 10,
      refillIntervalMs: 60_000,
    });

    const result = await limiter.take("phone-1");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(7);
    expect(result.retryAfterMs).toBeUndefined();
  });

  it("returns allowed:false with retryAfterMs when Redis denies", async () => {
    const redis = makeRedis([0, 0, 5_000]);
    const limiter = createRedisTokenBucket(redis, {
      capacity: 10,
      refillTokens: 10,
      refillIntervalMs: 60_000,
    });

    const result = await limiter.take("phone-1");

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBe(5_000);
  });

  it("uses rl:{namespace}:{key} as the Redis key", async () => {
    const redis = makeRedis([1, 9, 0]);
    const limiter = createRedisTokenBucket(redis, {
      capacity: 10,
      refillTokens: 10,
      refillIntervalMs: 60_000,
      namespace: "wa-webhook",
    });

    await limiter.take("48123456789");

    const call = (redis.eval as ReturnType<typeof vi.fn>).mock.calls[0];

    expect(call![2]).toBe("rl:wa-webhook:48123456789");
  });

  it("uses rl:default:{key} when namespace is omitted", async () => {
    const redis = makeRedis([1, 9, 0]);
    const limiter = createRedisTokenBucket(redis, {
      capacity: 10,
      refillTokens: 10,
      refillIntervalMs: 60_000,
    });

    await limiter.take("phone-1");

    const call = (redis.eval as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call![2]).toBe("rl:default:phone-1");
  });

  it("passes capacity, refillPerMs, cost, and ttl as strings to eval", async () => {
    const redis = makeRedis([1, 0, 0]);
    const limiter = createRedisTokenBucket(redis, {
      capacity: 5,
      refillTokens: 5,
      refillIntervalMs: 60_000,
    });

    await limiter.take("phone-1");

    const call = (redis.eval as ReturnType<typeof vi.fn>).mock.calls[0];
    
    expect(call![3]).toBe("5"); // capacity
    expect(call![4]).toBe(String(5 / 60_000)); // refillPerMs
    expect(call![6]).toBe("1"); // cost
  });
});
