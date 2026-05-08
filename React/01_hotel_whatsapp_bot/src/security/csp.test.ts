import { describe, expect, it } from "vitest";
import { buildCsp } from "./csp";

describe("buildCsp", () => {
  it("contains nonce in script-src and style-src", () => {
    const result = buildCsp("abc123");

    expect(result).toContain("script-src 'self' 'nonce-abc123'");
    expect(result).toContain("style-src 'self' 'nonce-abc123'");
  });

  it("contains default-src 'self'", () => {
    expect(buildCsp("x")).toContain("default-src 'self'");
  });

  it("contains default-src 'self'", () => {
    expect(buildCsp("x")).toContain("frame-ancestors 'none'");
  });

  it("restricts base-uri to 'self'", () => {
    expect(buildCsp("x")).toContain("base-uri 'self'");
  });

  it("ogranicza base-uri do 'self'", () => {
    expect(buildCsp("nonce-1")).not.toBe(buildCsp("nonce-2"));
  });
});
