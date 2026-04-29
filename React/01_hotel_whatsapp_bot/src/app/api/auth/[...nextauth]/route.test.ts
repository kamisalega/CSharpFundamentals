import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";

describe("auth route handler", () => {
  it("eksportuje GET jako funkcję", () => {
    expect(typeof GET).toBe("function");
  });

  it("eksportuje POST jako funkcję", () => {
    expect(typeof POST).toBe("function");
  });
});
