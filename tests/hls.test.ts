import { describe, expect, it, vi } from "vitest";

import { assessHlsSource } from "../src/media/hls";

const hlsSource = {
  type: "hls" as const,
  url: "https://v1.pinimg.com/videos/demo.m3u8",
  width: 720,
  height: 1280,
};

describe("assessHlsSource", () => {
  it("reports Pinterest CORS blocking with a user-facing explanation", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(assessHlsSource(hlsSource, { fetcher })).resolves.toEqual({
      kind: "blocked",
      message: "Browser cannot process this HLS stream because Pinterest blocks playlist access.",
    });
  });

  it("reports an unavailable playlist as a source error", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 404 }),
    );

    await expect(assessHlsSource(hlsSource, { fetcher }))
      .rejects.toThrow("Video source is unavailable");
  });

  it("does not claim remux support for an unverified readable layout", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\nvideo.m3u8", {
        status: 200,
        headers: { "content-type": "application/vnd.apple.mpegurl" },
      }),
    );

    await expect(assessHlsSource(hlsSource, { fetcher })).resolves.toEqual({
      kind: "unsupported",
      message: "This HLS stream is readable, but its no-transcode MP4 remux path has not been verified.",
    });
  });

  it("rejects a readable response that is not an HLS playlist", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("<html>not a playlist</html>", { status: 200 }),
    );

    await expect(assessHlsSource(hlsSource, { fetcher }))
      .rejects.toThrow("Video source is unavailable");
  });

  it("rejects an MP4 source on the HLS path", async () => {
    await expect(assessHlsSource({
      type: "mp4",
      url: "https://v1.pinimg.com/videos/demo.mp4",
    })).rejects.toThrow("Video source is unavailable");
  });

  it("turns an aborted playlist request into cancellation", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(
      new DOMException("The operation was aborted", "AbortError"),
    );

    await expect(assessHlsSource(hlsSource, { fetcher }))
      .rejects.toThrow("Request cancelled");
  });

  it("invokes a browser-branded fetch with the global receiver", async () => {
    const fetcher = vi.fn(function (this: typeof globalThis) {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }
      return Promise.resolve(new Response("#EXTM3U\n#EXTINF:4,\nsegment.ts", {
        status: 200,
      }));
    }) as unknown as typeof fetch;

    await expect(assessHlsSource(hlsSource, { fetcher })).resolves.toMatchObject({
      kind: "unsupported",
    });
  });
});
