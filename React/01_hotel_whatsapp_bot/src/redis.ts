import Redis from "ioredis";
import { getEnv } from "./config/env";

let instance: Redis | null = null;

export function getRedisClient(): Redis {
  if (!instance) {
    const { REDIS_URL } = getEnv();
    instance = new Redis(REDIS_URL!, {
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 100, 3_000),
      maxRetriesPerRequest: 3,
    });
  }
  return instance;
}

export async function closeRedisClient(): Promise<void> {
  if (instance) {
    await instance.quit();
    instance = null;
  }
}
