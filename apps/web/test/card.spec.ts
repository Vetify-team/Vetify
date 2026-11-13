import { describe, expect, it } from "vitest";
import { cardVerifyUrl, tokenFromCardLink } from "../src/lib/card";

const TOKEN = "eyJwIjoicGV0In0.c2lnbmF0dXJlLXNpZ25hdHVyZQ";
const OWNER = "https://app.vetify.live";

describe("card link", () => {
  it("puts the token in the fragment, which never reaches a server", () => {
    expect(cardVerifyUrl(OWNER, "abc_123")).toBe(
      "https://app.vetify.live/verificar#abc_123",
    );
  });

  it("reads the token of a card link of this environment", () => {
    expect(tokenFromCardLink(cardVerifyUrl(OWNER, TOKEN), OWNER)).toBe(TOKEN);
    expect(tokenFromCardLink(`  ${OWNER}/verificar#${TOKEN}\n`, OWNER)).toBe(TOKEN);
    // The older form, with the token in the path.
    expect(tokenFromCardLink(`${OWNER}/verificar/${TOKEN}`, OWNER)).toBe(TOKEN);
  });

  it("refuses links of another environment or another site", () => {
    expect(
      tokenFromCardLink(`https://app.stg.vetify.live/verificar#${TOKEN}`, OWNER),
    ).toBeNull();
    expect(
      tokenFromCardLink(`https://evil.example/verificar#${TOKEN}`, OWNER),
    ).toBeNull();
    expect(
      tokenFromCardLink(`http://app.vetify.live/verificar#${TOKEN}`, OWNER),
    ).toBeNull();
    expect(
      tokenFromCardLink(
        `https://app.stg.vetify.live/verificar#${TOKEN}`,
        "https://app.stg.vetify.live",
      ),
    ).toBe(TOKEN);
  });

  it("refuses anything that is not a card link with a well-formed token", () => {
    expect(tokenFromCardLink("hola", OWNER)).toBeNull();
    expect(tokenFromCardLink(`${OWNER}/mascotas#${TOKEN}`, OWNER)).toBeNull();
    expect(tokenFromCardLink(`${OWNER}/verificar`, OWNER)).toBeNull();
    expect(tokenFromCardLink(`${OWNER}/verificar#corto`, OWNER)).toBeNull();
    expect(tokenFromCardLink(`${OWNER}/verificar#${TOKEN}<script>`, OWNER)).toBeNull();
    expect(
      tokenFromCardLink(`javascript:alert(1)//${OWNER}/verificar#${TOKEN}`, OWNER),
    ).toBeNull();
  });
});
