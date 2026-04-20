import { describe, expect, it } from "vitest";
import { maskEmail, maskPhone } from "./maskPII";

describe("maskPhone", () => {
  it("masks the middle of the French number, leaving the prefix and the last 2 digits", () => {
    expect(maskPhone("+33612345678")).toBe("+336******78");
  });

  it("supports shorter number (no crash)", () => {
    expect(maskPhone("+33123")).toBe("+33***");
  });
  it("returns a placeholder for an empty string", () => {
    expect(maskPhone("")).toBe("***");
  });
});

describe("maskEmail", () => {
  it("masks local-part leaving the first letter", () => {
    expect(maskEmail("marie.dupont@email.com")).toBe("m***@email.com");
  });

  it("supports single-character local-part", () => {
    expect(maskEmail("a@b.com")).toBe("*@b.com");
  });

  it("returns the placeholder for the non-email", () => {
    expect(maskEmail("not-an-email")).toBe("***");
  });
});
