import { describe, expect, it } from "vitest";
import { getCorrelationId, runWithCorrelationId } from "./correlationId";

describe("correlationId", () => {
  it("returns the id set in the context", () => {
    const id = "test-correlation-123";
    const result = runWithCorrelationId(id, () => getCorrelationId());
    expect(result).toBe(id);
  });

  it("returns undefined outside of context", () => {
    expect(getCorrelationId()).toBeUndefined();
  });

  it("isolates values ​​between independent contexts", async () => {
    const results = await Promise.all([
      Promise.resolve().then(() =>
        runWithCorrelationId("a", () => getCorrelationId()),
      ),
      Promise.resolve().then(() =>
        runWithCorrelationId("b", () => getCorrelationId()),
      ),
    ]);

    expect(results).toEqual(["a", "b"]);
  });
});
