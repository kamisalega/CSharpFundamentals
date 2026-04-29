import { describe, expect, it } from "vitest";
import { buildCsp } from "./csp";

  describe("buildCsp", () => {
    it("zawiera nonce w script-src i style-src", () => {
      const result = buildCsp("abc123");

      expect(result).toContain("script-src 'self' 'nonce-abc123'");
      expect(result).toContain("style-src 'self' 'nonce-abc123'");
    });

    it("zawiera default-src 'self'", () => {
      expect(buildCsp("x")).toContain("default-src 'self'");
    });

    it("blokuje framing (frame-ancestors 'none')", () => {
      expect(buildCsp("x")).toContain("frame-ancestors 'none'");
    });

    it("ogranicza base-uri do 'self'", () => {
      expect(buildCsp("x")).toContain("base-uri 'self'");
    });

    it("różne nonce → różna wartość headera", () => {
      expect(buildCsp("nonce-1")).not.toBe(buildCsp("nonce-2"));
    });
  });