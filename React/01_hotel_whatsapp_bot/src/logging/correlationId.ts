import { AsyncLocalStorage } from "node:async_hooks";

type Store = { correlationId: string };

const storage = new AsyncLocalStorage<Store>();

export function runWithCorrelationId<T>(id: string, fn: () => T) {
  return storage.run({ correlationId: id }, fn);
}

export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}
