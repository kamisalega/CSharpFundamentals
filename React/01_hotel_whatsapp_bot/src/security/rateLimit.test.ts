import { describe, expect, it } from "vitest";
import { createTokenBucketLimiter } from "./rateLimit";

function fakeNow() {
  let t = 0;
  return {
    advance: (ms: number) => {
      t += ms;
    },
    fn: () => t,
  };
}

describe("createTokenBucketLimiter", () => {
  it("passes the first N requests until capacity is exhausted", async () => {
    const clock = fakeNow();
    const limiter = createTokenBucketLimiter({
      capacity: 3,
      refillTokens: 3,
      refillIntervalMs: 66_000,
      now: clock.fn,
    });

    const a = await limiter.take("phone-1");
    const b = await limiter.take("phone-1");
    const c = await limiter.take("phone-1");

    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
    expect(c.allowed).toBe(true);
    expect(c.remaining).toBe(0);
  });

  it("blocks the request after the capacity is exhausted", async () => {
    const clock = fakeNow();
    const limiter = createTokenBucketLimiter({
      capacity: 2,
      refillTokens: 2,
      refillIntervalMs: 60_000,
      now: clock.fn,
    });
    await limiter.take("phone-1");
    await limiter.take("phone-1");

    const blocked = await limiter.take("phone-1");

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("replenishes tokens gradually (does not wait for the window to be full)", async () => {
    const clock = fakeNow();
    const limiter = createTokenBucketLimiter({
      capacity: 10,
      refillTokens: 10,
      refillIntervalMs: 60_000,
      now: clock.fn,
    });

    for (let i = 0; i < 10; i++) await limiter.take("phone-1");

    clock.advance(6_000);
    const next = await limiter.take("phone-1");

    expect(next.allowed).toBe(true);
  });

  it("holds independent buckets for different keys", async () => {
    const clock = fakeNow();
    const limiter = createTokenBucketLimiter({
      capacity: 1,
      refillTokens: 1,
      refillIntervalMs: 60_000,
      now: clock.fn,
    });
    await limiter.take("phone-A");

    const aBlocked = await limiter.take("phone-A");
    const bAllowed = await limiter.take("phone-B");

    expect(aBlocked.allowed).toBe(false);
    expect(bAllowed.allowed).toBe(true);
  });

  it("does not exceed capacity even after a long break", async () => {
    const clock = fakeNow();
    const limiter = createTokenBucketLimiter({
      capacity: 5,
      refillTokens: 5,
      refillIntervalMs: 60_000,
      now: clock.fn,
    });
    await limiter.take("phone-1"); 

    clock.advance(10 * 60_000);

    let allowed = 0;
    for (let i = 0; i < 6; i++) {
      const r = await limiter.take("phone-1");
      if (r.allowed) allowed++;
    }
    expect(allowed).toBe(5);
  });
});
