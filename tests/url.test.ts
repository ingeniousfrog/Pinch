import { describe, expect, it } from "vitest";

import { parsePinterestUrl } from "../src/core/url";

describe("parsePinterestUrl", () => {
  it("normalizes a canonical Pin URL", () => {
    expect(parsePinterestUrl("https://www.pinterest.com/pin/111111111111111111/"))
      .toEqual({
        pinId: "111111111111111111",
        canonicalUrl: "https://www.pinterest.com/pin/111111111111111111/",
      });
  });

  it("trims input and removes query and fragment data", () => {
    expect(parsePinterestUrl("  https://pinterest.com/pin/12345/?utm_source=x#media  "))
      .toEqual({
        pinId: "12345",
        canonicalUrl: "https://www.pinterest.com/pin/12345/",
      });
  });

  it("accepts a locale Pinterest domain", () => {
    expect(parsePinterestUrl("http://www.pinterest.co.uk/pin/67890/"))
      .toEqual({
        pinId: "67890",
        canonicalUrl: "https://www.pinterest.com/pin/67890/",
      });
  });

  it.each([
    "",
    "not a url",
    "https://example.com/pin/123/",
    "https://www.pinterest.com/board/123/",
    "https://www.pinterest.com/pin/not-numeric/",
    "https://www.pinterest.com/pin/123/extra",
    `https://www.pinterest.com/pin/${"1".repeat(31)}/`,
    "https://pin.it/abc123",
  ])("rejects unsupported input %s", (input) => {
    expect(() => parsePinterestUrl(input)).toThrow("Invalid Pinterest URL");
  });
});
