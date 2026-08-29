import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

import { livePinSkipReason, primaryLivePin } from "./live-pins";

test.beforeEach(async ({ page }) => {
  await page.goto("/Pinch/");
});

test("renders the focused utility first screen", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Pinch." })).toBeVisible();
  await expect(page.getByPlaceholder("Paste a Pinterest URL…")).toBeVisible();
  await expect(page.getByRole("button", { name: /Get MP4/ })).toBeEnabled();
});

test("shows a human-readable invalid URL error", async ({ page }) => {
  await page.getByPlaceholder("Paste a Pinterest URL…").fill("https://example.com/not-a-pin");
  await page.getByRole("button", { name: /Get MP4/ }).click();

  await expect(page.getByTestId("error-message")).toHaveText("Invalid Pinterest URL");
});

test("explains the static-app workaround for pin.it short links", async ({ page }) => {
  await page.getByPlaceholder("Paste a Pinterest URL…").fill("https://pin.it/demoShort");
  await page.getByRole("button", { name: /Get MP4/ }).click();

  await expect(page.getByTestId("error-message")).toHaveText(
    "Pinterest short links cannot be resolved in this static app. "
      + "Open the link, then copy the full pinterest.com/pin/... URL.",
  );
});

test("resolves a live public Pin and exposes the honest MP4 action", async ({ page }, testInfo) => {
  test.skip(!primaryLivePin, livePinSkipReason);
  if (!primaryLivePin) {
    return;
  }

  await page.getByPlaceholder("Paste a Pinterest URL…").fill(
    `https://www.pinterest.com/pin/${primaryLivePin.pinId}/`,
  );
  await page.getByRole("button", { name: /Get MP4/ }).click();

  await expect(page.getByTestId("result-card")).toBeVisible();
  await expect(page.getByTestId("media-meta")).toContainText("MP4");
  await expect(page.getByTestId("media-action")).toHaveText("Open MP4");

  if (testInfo.project.name === "chrome-live" && process.env.PINCH_SCREENSHOT) {
    await page.screenshot({
      path: resolve(process.cwd(), "docs", "pinch-screenshot.png"),
      fullPage: true,
      animations: "disabled",
    });
  }
});

test("theme toggle applies the dark palette", async ({ page }) => {
  await page.getByTestId("theme-toggle").click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("mobile layout has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(dimensions.content).toBe(dimensions.viewport);
});
