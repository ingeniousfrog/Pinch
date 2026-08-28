import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { livePinSkipReason, livePins, primaryLivePin } from "./live-pins";

interface FetchProbe {
  readonly resolved: boolean;
  readonly status?: number;
  readonly body?: string;
  readonly error?: string;
}

const probeFetch = async (
  page: Page,
  url: string,
  readBody = false,
): Promise<FetchProbe> => page.evaluate(
  async ({ target, shouldReadBody }) => {
    try {
      const response = await fetch(target, {
        mode: "cors",
        credentials: "omit",
      });
      return {
        resolved: true,
        status: response.status,
        ...(shouldReadBody ? { body: await response.text() } : {}),
      };
    } catch (error) {
      return {
        resolved: false,
        error: error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error",
      };
    }
  },
  { target: url, shouldReadBody: readBody },
);

test.beforeEach(async ({ page }) => {
  await page.goto("/Pinch/");
});

test.skip(livePins.length === 0, livePinSkipReason);

const primaryMp4Url = primaryLivePin?.mp4Url ?? "";

for (const { pinId, mp4Url, hlsUrl } of livePins) {
  const pinUrl = `https://www.pinterest.com/pin/${pinId}/`;
  const oEmbedUrl =
    `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(pinUrl)}`;
  const widgetUrl =
    `https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=${pinId}`;

  test(`public widget JSON resolves MP4 and HLS for ${pinId}`, async ({ page }) => {
    const result = await probeFetch(page, widgetUrl, true);

    expect(result).toMatchObject({
      resolved: true,
      status: 200,
      body: expect.stringMatching(/\.mp4["?].*\.m3u8|\.m3u8["?].*\.mp4/s),
    });
  });

  test(`direct Pin HTML is blocked by browser CORS for ${pinId}`, async ({ page }) => {
    await expect(probeFetch(page, pinUrl)).resolves.toMatchObject({
      resolved: false,
      error: expect.stringContaining("Failed to fetch"),
    });
  });

  test(`oEmbed JSON is blocked by browser CORS for ${pinId}`, async ({ page }) => {
    await expect(probeFetch(page, oEmbedUrl)).resolves.toMatchObject({
      resolved: false,
      error: expect.stringContaining("Failed to fetch"),
    });
  });

  test(`MP4 bytes are not readable through fetch for ${pinId}`, async ({ page }) => {
    await expect(probeFetch(page, mp4Url)).resolves.toMatchObject({
      resolved: false,
      error: expect.stringContaining("Failed to fetch"),
    });
  });

  test(`HLS playlist bytes are not readable through fetch for ${pinId}`, async ({ page }) => {
    await expect(probeFetch(page, hlsUrl)).resolves.toMatchObject({
      resolved: false,
      error: expect.stringContaining("Failed to fetch"),
    });
  });
}

test("opaque cross-origin MP4 still loads video metadata", async ({ page }) => {
  await page.evaluate((url) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.dataset.testid = "cors-preview";
    video.src = url;
    document.body.append(video);
  }, primaryMp4Url);

  await expect.poll(
    () => page.getByTestId("cors-preview").evaluate(
      (video) => (video as HTMLVideoElement).readyState,
    ),
  ).toBeGreaterThanOrEqual(1);
});

test("cross-origin download link opens media instead of emitting a file download", async ({ page }) => {
  await page.evaluate((url) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = "pinch.mp4";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Probe download";
    document.body.append(link);
  }, primaryMp4Url);

  const popupResult = page
    .waitForEvent("popup", { timeout: 15_000 })
    .then(async (popup) => {
      await popup.close();
      return "popup" as const;
    })
    .catch(() => "no-popup" as const);
  const downloadResult = page
    .waitForEvent("download", { timeout: 15_000 })
    .then(() => "download" as const)
    .catch(() => "no-download" as const);

  await page.getByRole("link", { name: "Probe download" }).click();

  expect(await Promise.race([popupResult, downloadResult])).toBe("popup");
});
