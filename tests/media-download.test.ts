import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMp4Action,
  downloadReadableMp4,
  probeMediaAccess,
} from "../src/media/download";
import type { BlobDownloadAction } from "../src/media/types";

const mp4Source = {
  type: "mp4" as const,
  url: "https://v1.pinimg.com/videos/demo.mp4",
  width: 720,
  height: 1280,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("probeMediaAccess", () => {
  it("reports a successful byte-range response as readable", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([0]), { status: 206 }),
    );

    await expect(probeMediaAccess(mp4Source.url, { fetcher }))
      .resolves.toBe("readable");
  });

  it("uses a one-byte CORS range request without credentials", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([0]), { status: 206 }),
    );

    await probeMediaAccess(mp4Source.url, { fetcher });

    expect(fetcher).toHaveBeenCalledWith(mp4Source.url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      headers: { Range: "bytes=0-0" },
    });
  });

  it("reports a browser CORS TypeError as opaque", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(probeMediaAccess(mp4Source.url, { fetcher }))
      .resolves.toBe("opaque");
  });

  it("reports a non-success response as unavailable", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 404 }),
    );

    await expect(probeMediaAccess(mp4Source.url, { fetcher }))
      .resolves.toBe("unavailable");
  });

  it("turns an abort into a user-facing cancellation", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(
      new DOMException("The operation was aborted", "AbortError"),
    );

    await expect(probeMediaAccess(mp4Source.url, { fetcher }))
      .rejects.toThrow("Request cancelled");
  });

  it("invokes a browser-branded fetch with the global receiver", async () => {
    const fetcher = vi.fn(function (this: typeof globalThis) {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }
      return Promise.resolve(new Response(new Uint8Array([0]), { status: 206 }));
    }) as unknown as typeof fetch;

    await expect(probeMediaAccess(mp4Source.url, { fetcher }))
      .resolves.toBe("readable");
  });
});

describe("createMp4Action", () => {
  it("creates a real download action for readable media", () => {
    expect(createMp4Action("111111111111111111", mp4Source, "readable"))
      .toEqual({
        kind: "blob-download",
        label: "Download MP4",
        url: mp4Source.url,
        filename: "pinch-111111111111111111.mp4",
        help: "Downloads the original MP4 without re-encoding.",
      });
  });

  it("creates an honest open action for opaque media", () => {
    expect(createMp4Action("111111111111111111", mp4Source, "opaque"))
      .toEqual({
        kind: "direct-open",
        label: "Open MP4",
        url: mp4Source.url,
        help: "Pinterest blocks direct file saving here. Open the original video, then use your browser's save command.",
      });
  });

  it("rejects an unavailable source", () => {
    expect(() => createMp4Action("111111111111111111", mp4Source, "unavailable"))
      .toThrow("Video source is unavailable");
  });

  it("rejects an HLS source on the MP4 path", () => {
    expect(() => createMp4Action(
      "111111111111111111",
      { type: "hls", url: "https://v1.pinimg.com/videos/demo.m3u8" },
      "readable",
    )).toThrow("Video source is unavailable");
  });
});

describe("downloadReadableMp4", () => {
  const action: BlobDownloadAction = {
    kind: "blob-download",
    label: "Download MP4",
    url: mp4Source.url,
    filename: "pinch-111111111111111111.mp4",
    help: "Downloads the original MP4 without re-encoding.",
  };

  it("downloads the original bytes through a temporary Blob URL", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([0, 1, 2]), {
        status: 200,
        headers: { "content-type": "video/mp4" },
      }),
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const createObjectUrl = vi.fn(() => "blob:pinch-test");
    const revokeObjectUrl = vi.fn();

    await downloadReadableMp4(action, {
      fetcher,
      document,
      createObjectUrl,
      revokeObjectUrl,
    });

    expect({
      clicked: click.mock.calls.length,
      created: createObjectUrl.mock.calls.length,
      revokedWith: revokeObjectUrl.mock.calls[0]?.[0],
    }).toEqual({ clicked: 1, created: 1, revokedWith: "blob:pinch-test" });
  });

  it("rejects a response that is not an MP4", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("not video", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    await expect(downloadReadableMp4(action, { fetcher, document }))
      .rejects.toThrow("Video source is unavailable");
  });

  it("reports cancellation during the full download", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(
      new DOMException("The operation was aborted", "AbortError"),
    );

    await expect(downloadReadableMp4(action, { fetcher, document }))
      .rejects.toThrow("Request cancelled");
  });

  it("reports CORS blocking if access changes after the probe", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(downloadReadableMp4(action, { fetcher, document }))
      .rejects.toThrow("Pinterest blocked cross-origin access");
  });

  it("reports an unexpected download failure as unavailable", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("Socket closed"));

    await expect(downloadReadableMp4(action, { fetcher, document }))
      .rejects.toThrow("Video source is unavailable");
  });

  it("rejects an empty MP4 response", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array(), {
        status: 200,
        headers: { "content-type": "video/mp4" },
      }),
    );

    await expect(downloadReadableMp4(action, { fetcher, document }))
      .rejects.toThrow("Video source is unavailable");
  });

  it("invokes a browser-branded fetch with the global receiver", async () => {
    const fetcher = vi.fn(function (this: typeof globalThis) {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }
      return Promise.resolve(new Response(new Uint8Array([0, 1]), {
        status: 200,
        headers: { "content-type": "video/mp4" },
      }));
    }) as unknown as typeof fetch;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await expect(downloadReadableMp4(action, {
      fetcher,
      document,
      createObjectUrl: () => "blob:pinch-test",
      revokeObjectUrl: () => undefined,
    })).resolves.toBeUndefined();
  });
});
