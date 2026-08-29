import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { BrowserResolver } from "../src/core/browser-resolver";

const widgetPayload = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "tests", "fixtures", "widget-story-pin.json"),
    "utf8",
  ),
);

describe("BrowserResolver", () => {
  it("resolves a supported Pin through Pinterest widget JSON", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(widgetPayload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const resolver = new BrowserResolver(fetcher);

    await expect(
      resolver.resolve("https://www.pinterest.com/pin/111111111111111111/"),
    ).resolves.toMatchObject({
      pinId: "111111111111111111",
      sources: expect.arrayContaining([expect.objectContaining({ type: "mp4" })]),
    });
  });

  it("requests only the normalized numeric Pin ID", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(widgetPayload), { status: 200 }),
    );
    const resolver = new BrowserResolver(fetcher);

    await resolver.resolve("https://pinterest.com/pin/111111111111111111/?utm=x");

    expect(fetcher).toHaveBeenCalledWith(
      "https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=111111111111111111",
      expect.objectContaining({ credentials: "omit" }),
    );
  });

  it("resolves a full sent-share URL through the normalized Pin ID", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(widgetPayload), { status: 200 }),
    );
    const resolver = new BrowserResolver(fetcher);

    await resolver.resolve(
      "https://www.pinterest.com/pin/111111111111111111/sent/?invite_code=demo&sfo=1",
    );

    expect(fetcher).toHaveBeenCalledWith(
      "https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=111111111111111111",
      expect.objectContaining({ credentials: "omit" }),
    );
  });

  it("reports an empty widget result as a missing Pin", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ status: "success", data: [] }), { status: 200 }),
    );
    const resolver = new BrowserResolver(fetcher);

    await expect(
      resolver.resolve("https://www.pinterest.com/pin/111111111111111111/"),
    ).rejects.toThrow("Pin not found");
  });

  it("rejects widget data that belongs to a different Pin", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        status: "success",
        data: [{
          id: "999999999999999999",
          videos: {
            video_list: {
              V_720P: { url: "https://v1.pinimg.com/videos/wrong-pin.mp4" },
            },
          },
        }],
      }), { status: 200 }),
    );
    const resolver = new BrowserResolver(fetcher);

    await expect(
      resolver.resolve("https://www.pinterest.com/pin/111111111111111111/"),
    ).rejects.toThrow("Pin not found");
  });

  it("rejects a malformed widget payload at the network boundary", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ status: "success", video: "unexpected" }), {
        status: 200,
      }),
    );
    const resolver = new BrowserResolver(fetcher);

    await expect(
      resolver.resolve("https://www.pinterest.com/pin/111111111111111111/"),
    ).rejects.toThrow("Video source is unavailable");
  });

  it("reports an HTTP 404 as a missing Pin", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 404 }),
    );
    const resolver = new BrowserResolver(fetcher);

    await expect(
      resolver.resolve("https://www.pinterest.com/pin/111111111111111111/"),
    ).rejects.toThrow("Pin not found");
  });

  it("reports another non-success response as an unavailable source", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 503 }),
    );
    const resolver = new BrowserResolver(fetcher);

    await expect(
      resolver.resolve("https://www.pinterest.com/pin/111111111111111111/"),
    ).rejects.toThrow("Video source is unavailable");
  });

  it("turns a network TypeError into a cross-origin message", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));
    const resolver = new BrowserResolver(fetcher);

    await expect(
      resolver.resolve("https://www.pinterest.com/pin/111111111111111111/"),
    ).rejects.toThrow("Pinterest blocked cross-origin access");
  });

  it("reports an aborted fetch as cancellation", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(
      new DOMException("The operation was aborted", "AbortError"),
    );
    const resolver = new BrowserResolver(fetcher);

    await expect(
      resolver.resolve("https://www.pinterest.com/pin/111111111111111111/"),
    ).rejects.toThrow("Request cancelled");
  });

  it("reports malformed widget JSON as an unavailable source", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("not json", { status: 200 }),
    );
    const resolver = new BrowserResolver(fetcher);

    await expect(
      resolver.resolve("https://www.pinterest.com/pin/111111111111111111/"),
    ).rejects.toThrow("Video source is unavailable");
  });

  it("passes an abort signal to fetch", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(widgetPayload), { status: 200 }),
    );
    const resolver = new BrowserResolver(fetcher);
    const controller = new AbortController();

    await resolver.resolve("https://www.pinterest.com/pin/111111111111111111/", {
      signal: controller.signal,
    });

    expect(fetcher).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("invokes a browser-branded fetch with the global receiver", async () => {
    const fetcher = vi.fn(function (this: typeof globalThis) {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }
      return Promise.resolve(
        new Response(JSON.stringify(widgetPayload), { status: 200 }),
      );
    }) as unknown as typeof fetch;
    const resolver = new BrowserResolver(fetcher);

    await expect(
      resolver.resolve("https://www.pinterest.com/pin/111111111111111111/"),
    ).resolves.toMatchObject({ pinId: "111111111111111111" });
  });
});
