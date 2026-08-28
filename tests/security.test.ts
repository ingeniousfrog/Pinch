import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("static security policy", () => {
  it("restricts scripts, connections, media, and embedded objects with CSP", () => {
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).toContain("script-src 'self'");
    expect(html).toContain("connect-src 'self' https://widgets.pinterest.com https://*.pinimg.com");
    expect(html).toContain("media-src https://*.pinimg.com blob:");
    expect(html).toContain("object-src 'none'");
  });
});
