import { describe, expect, it } from "vitest";

import { selectBestSource } from "../src/core/select";
import type { VideoSource } from "../src/core/types";

describe("selectBestSource", () => {
  it("prefers progressive MP4 over a larger HLS source", () => {
    expect(
      selectBestSource([
        { url: "https://v1.pinimg.com/video.m3u8", type: "hls", width: 1080 },
        { url: "https://v1.pinimg.com/video.mp4", type: "mp4", width: 720 },
      ]),
    ).toMatchObject({ type: "mp4", width: 720 });
  });

  it("selects the largest standard MP4 quality", () => {
    expect(
      selectBestSource([
        { url: "https://v1.pinimg.com/360.mp4", type: "mp4", width: 360 },
        { url: "https://v1.pinimg.com/720.mp4", type: "mp4", width: 720 },
      ]),
    ).toMatchObject({ width: 720 });
  });

  it("prefers broadly compatible AVC over a larger trial HEVC source", () => {
    expect(
      selectBestSource([
        {
          url: "https://v1.pinimg.com/trial.mp4",
          type: "mp4",
          width: 1080,
          quality: "V_EXP7",
          codec: "hvc1",
        },
        {
          url: "https://v1.pinimg.com/standard.mp4",
          type: "mp4",
          width: 720,
          quality: "V_720P",
          codec: "avc1.64001f",
        },
      ]),
    ).toMatchObject({ url: "https://v1.pinimg.com/standard.mp4" });
  });

  it("uses bitrate after pixel area", () => {
    expect(
      selectBestSource([
        {
          url: "https://v1.pinimg.com/low.mp4",
          type: "mp4",
          width: 720,
          height: 1280,
          bitrate: 800_000,
        },
        {
          url: "https://v1.pinimg.com/high.mp4",
          type: "mp4",
          width: 720,
          height: 1280,
          bitrate: 1_200_000,
        },
      ]),
    ).toMatchObject({ bitrate: 1_200_000 });
  });

  it("returns undefined for an empty list", () => {
    expect(selectBestSource([])).toBeUndefined();
  });

  it("uses URL ordering as a deterministic final tie-breaker", () => {
    expect(
      selectBestSource([
        { url: "https://v1.pinimg.com/z.mp4", type: "mp4", width: 720 },
        { url: "https://v1.pinimg.com/a.mp4", type: "mp4", width: 720 },
      ]),
    ).toMatchObject({ url: "https://v1.pinimg.com/a.mp4" });
  });

  it("does not mutate the source list", () => {
    const sources: readonly VideoSource[] = Object.freeze([
      Object.freeze({ url: "https://v1.pinimg.com/360.mp4", type: "mp4", width: 360 }),
      Object.freeze({ url: "https://v1.pinimg.com/720.mp4", type: "mp4", width: 720 }),
    ]);

    selectBestSource(sources);

    expect(sources.map(({ width }) => width)).toEqual([360, 720]);
  });
});
