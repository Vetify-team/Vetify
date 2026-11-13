import { describe, expect, it } from "vitest";
import { cardVerifyUrl } from "../src/lib/card";

describe("card link", () => {
  it("puts the token in the fragment, which never reaches a server", () => {
    expect(cardVerifyUrl("https://app.vetify.live", "abc_123")).toBe(
      "https://app.vetify.live/verificar#abc_123",
    );
  });
});
