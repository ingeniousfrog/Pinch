import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  extractPinVideoFromHtml,
  extractPinVideoFromJson,
} from "../src/core/extract";

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), "tests", "fixtures", name),
      "utf8",
    ),
  );

describe("extractPinVideoFromJson", () => {
  it("extracts nested story-Pin MP4 and HLS sources despite false top-level flags", () => {
    expect(extractPinVideoFromJson(fixture("widget-story-pin.json"), "111111111111111111"))
      .toMatchObject({
        pinId: "111111111111111111",
        title: "A tiny demo",
        description: "Fixture story Pin",
        sources: [
          {
            type: "hls",
            quality: "V_HLSV4",
            width: 576,
            height: 1024,
          },
          {
            type: "mp4",
            quality: "V_720P",
            width: 576,
            height: 1024,
          },
        ],
      });
  });

  it("extracts multiple progressive quality levels from video_list", () => {
    expect(extractPinVideoFromJson(fixture("legacy-pin.json"), "222222222222222222").sources)
      .toHaveLength(3);
  });

  it("supports videoList and videoUrls while rejecting non-Pinterest media", () => {
    expect(extractPinVideoFromJson(fixture("camel-and-video-urls.json"), "24680").sources)
      .toHaveLength(2);
  });

  it("deduplicates a source found through multiple Pinterest shapes", () => {
    const sources = extractPinVideoFromJson(
      fixture("camel-and-video-urls.json"),
      "24680",
    ).sources;

    expect(sources.filter(({ url }) => url.endsWith("demo_720w.mp4")))
      .toHaveLength(1);
  });

  it("rejects a Pin representation without video", () => {
    expect(() => extractPinVideoFromJson({ id: "99", images: {} }, "99"))
      .toThrow("This Pin does not contain a video");
  });

  it("tolerates missing optional metadata", () => {
    expect(
      extractPinVideoFromJson(
        { videoUrls: ["https://v1.pinimg.com/videos/demo.mp4"] },
        "101",
      ),
    ).toEqual({
      pinId: "101",
      sources: [
        {
          type: "mp4",
          url: "https://v1.pinimg.com/videos/demo.mp4",
        },
      ],
    });
  });
});

describe("extractPinVideoFromHtml", () => {
  const html = readFileSync(
    resolve(process.cwd(), "tests", "fixtures", "embedded-pin.html"),
    "utf8",
  );

  it("merges embedded JSON and Open Graph sources", () => {
    expect(extractPinVideoFromHtml(html, "13579").sources).toHaveLength(2);
  });

  it("uses Open Graph metadata for optional fields", () => {
    expect(extractPinVideoFromHtml(html, "13579")).toMatchObject({
      pinId: "13579",
      title: "Embedded fixture",
      description: "HTML fallback",
      thumbnail: "https://i.pinimg.com/originals/demo/poster.jpg",
    });
  });

  it("ignores malformed JSON script blocks", () => {
    expect(() => extractPinVideoFromHtml(html, "13579")).not.toThrow();
  });
});
