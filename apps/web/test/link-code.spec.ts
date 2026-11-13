import { describe, expect, it } from "vitest";
import {
  activeBox,
  codeFromPaste,
  formatCode,
  isComplete,
  normalizeCode,
} from "../src/lib/link-code";

describe("link code input", () => {
  it("keeps upper case and only the code's characters, at most 8", () => {
    expect(normalizeCode("k7pq")).toBe("K7PQ");
    expect(normalizeCode("K7PQ-4MXA")).toBe("K7PQ4MXA");
    expect(normalizeCode(" k7pq 4mxa ")).toBe("K7PQ4MXA");
    expect(normalizeCode("K7PQ4MXA99")).toBe("K7PQ4MXA");
  });

  it("drops the characters a code never has (I, L, O, 0, 1)", () => {
    expect(normalizeCode("IL01O")).toBe("");
    expect(normalizeCode("A1B")).toBe("AB");
  });

  it("accepts a pasted code with or without its hyphen", () => {
    expect(codeFromPaste("", "K7PQ-4MXA")).toBe("K7PQ4MXA");
    expect(codeFromPaste("", "k7pq4mxa")).toBe("K7PQ4MXA");
    expect(codeFromPaste("", "k7pq 4mxa")).toBe("K7PQ4MXA");
    // A whole code in a message replaces what was typed.
    expect(codeFromPaste("AB", "Tu código es K7PQ-4MXA, vence en 10 min")).toBe(
      "K7PQ4MXA",
    );
    // Loose characters are added after the ones typed.
    expect(codeFromPaste("K7PQ", "4mx")).toBe("K7PQ4MX");
  });

  it("shows XXXX-XXXX, with the hyphen only past the fourth character", () => {
    expect(formatCode("")).toBe("");
    expect(formatCode("K7PQ")).toBe("K7PQ");
    expect(formatCode("K7PQ4")).toBe("K7PQ-4");
    expect(formatCode("K7PQ4MXA")).toBe("K7PQ-4MXA");
    // Typing over the formatted value gives the same code back.
    expect(normalizeCode(formatCode("K7PQ4M") + "X")).toBe("K7PQ4MX");
  });

  it("moves the caret box forward as it fills and knows when it is complete", () => {
    expect(activeBox("")).toBe(0);
    expect(activeBox("K7P")).toBe(3);
    expect(activeBox("K7PQ4MXA")).toBe(7);
    expect(isComplete("K7PQ4MX")).toBe(false);
    expect(isComplete("K7PQ4MXA")).toBe(true);
  });
});
