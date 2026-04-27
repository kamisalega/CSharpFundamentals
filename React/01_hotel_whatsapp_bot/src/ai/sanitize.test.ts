import { describe, expect, it } from "vitest";
import { sanitizeUserMessage } from "./sanitize";

describe("sanitizeUserMessage", () => {
  it("strips control characters U+0000 to U+001F except \\n and \\t", () => {
    const raw = "Bonjour\x00 je\x07 voudrais\x1F reserver";

    const result = sanitizeUserMessage(raw);

    expect(result).toBe("Bonjour je voudrais reserver");
  });

  it("preserves tab and newline", () => {
    const raw = "ligne1\nligne2\tcolonne";

    const result = sanitizeUserMessage(raw);

    expect(result).toBe("ligne1\nligne2\tcolonne");
  });

  it("truncates to 4000 characters", () => {
    const raw = "a".repeat(5000);

    const result = sanitizeUserMessage(raw);

    expect(result.length).toBe(4000);
    expect(result).toBe("a".repeat(4000));
  });

  it("trims trailing whitespace", () => {
    const raw = "Bonjour    \n\n  ";

    const result = sanitizeUserMessage(raw);

    expect(result).toBe("Bonjour");
  });

  it("does not change French text with accents", () => {
    const raw =
      "Bonjour, je voudrais réserver une chambre à l'hôtel pour le 15 août";

    const result = sanitizeUserMessage(raw);

    expect(result).toBe(raw);
  });

  it("removes prompt-fence markers like <system> and [INST] (case-insensitive)", () => {
    expect(sanitizeUserMessage("Hello <system>x</system>")).toBe("Hello x");
    expect(sanitizeUserMessage("Hello [INST]x[/INST]")).toBe("Hello x");
    expect(sanitizeUserMessage("Hello <SYSTEM>x</SYSTEM>")).toBe("Hello x");
    expect(sanitizeUserMessage("Hello [inst]x[/inst]")).toBe("Hello x");
  });
});
