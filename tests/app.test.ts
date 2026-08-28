import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PinchError } from "../src/core/errors";
import type { PinResolver, PinVideo } from "../src/core/types";
import { mountPinchApp } from "../src/ui/app";
import type { AppDependencies } from "../src/ui/types";

const mp4Pin: PinVideo = {
  pinId: "111111111111111111",
  title: "A calm little video",
  description: "Fixture description",
  thumbnail: "https://i.pinimg.com/originals/demo/poster.jpg",
  sources: [
    {
      type: "mp4",
      url: "https://v1.pinimg.com/videos/demo.mp4",
      width: 720,
      height: 1280,
      quality: "V_720P",
    },
  ],
};

const hlsPin: PinVideo = {
  pinId: "222222222222222222",
  sources: [
    {
      type: "hls",
      url: "https://v1.pinimg.com/videos/demo.m3u8",
      width: 720,
      height: 1280,
    },
  ],
};

const createDependencies = (
  pin: PinVideo = mp4Pin,
  overrides: Partial<AppDependencies> = {},
): AppDependencies => ({
  resolver: {
    resolve: vi.fn().mockResolvedValue(pin),
  } satisfies PinResolver,
  probeMediaAccess: vi.fn().mockResolvedValue("opaque"),
  assessHlsSource: vi.fn().mockResolvedValue({
    kind: "blocked",
    message: "Browser cannot process this HLS stream because Pinterest blocks playlist access.",
  }),
  downloadReadableMp4: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const submitUrl = (root: HTMLElement, url = "https://www.pinterest.com/pin/111111111111111111/"): void => {
  const input = root.querySelector<HTMLInputElement>('[data-testid="url-input"]');
  const form = root.querySelector<HTMLFormElement>('[data-testid="resolve-form"]');
  if (!input || !form) {
    throw new Error("Test setup could not find the Pinch form");
  }
  input.value = url;
  form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
};

describe("mountPinchApp", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it("renders the focused first-screen product contract", () => {
    const root = document.querySelector<HTMLElement>("#app");
    if (!root) throw new Error("Missing test root");

    mountPinchApp(root, createDependencies());

    expect(root.textContent).toContain("Pinterest video → MP4");
  });

  it("resolves an opaque MP4 into an honest direct-open action", async () => {
    const root = document.querySelector<HTMLElement>("#app")!;
    mountPinchApp(root, createDependencies());

    submitUrl(root);

    await vi.waitFor(() => {
      expect(root.querySelector<HTMLAnchorElement>('[data-testid="media-action"]'))
        .toMatchObject({
          textContent: "Open MP4",
          href: "https://v1.pinimg.com/videos/demo.mp4",
          target: "_blank",
        });
    });
  });

  it("shows the selected source dimensions and format", async () => {
    const root = document.querySelector<HTMLElement>("#app")!;
    mountPinchApp(root, createDependencies());

    submitUrl(root);

    await vi.waitFor(() => {
      expect(root.querySelector('[data-testid="media-meta"]')?.textContent)
        .toContain("720 × 1280 · MP4");
    });
  });

  it("downloads a readable MP4 only after the user clicks", async () => {
    const downloadReadableMp4 = vi.fn().mockResolvedValue(undefined);
    const root = document.querySelector<HTMLElement>("#app")!;
    mountPinchApp(root, createDependencies(mp4Pin, {
      probeMediaAccess: vi.fn().mockResolvedValue("readable"),
      downloadReadableMp4,
    }));
    submitUrl(root);

    const action = await vi.waitFor(() => {
      const button = root.querySelector<HTMLButtonElement>('[data-testid="media-action"]');
      expect(button?.textContent).toBe("Download MP4");
      return button;
    });
    action?.click();

    await vi.waitFor(() => expect(downloadReadableMp4).toHaveBeenCalledOnce());
  });

  it("surfaces a failed readable download", async () => {
    const root = document.querySelector<HTMLElement>("#app")!;
    mountPinchApp(root, createDependencies(mp4Pin, {
      probeMediaAccess: vi.fn().mockResolvedValue("readable"),
      downloadReadableMp4: vi.fn().mockRejectedValue(
        new PinchError("source_unavailable", "Video source is unavailable"),
      ),
    }));
    submitUrl(root);

    const action = await vi.waitFor(() => {
      const button = root.querySelector<HTMLButtonElement>('[data-testid="media-action"]');
      expect(button).not.toBeNull();
      return button;
    });
    action?.click();

    await vi.waitFor(() => {
      expect(root.querySelector('[data-testid="error-message"]')?.textContent)
        .toBe("Video source is unavailable");
    });
  });

  it("surfaces the verified HLS browser limitation", async () => {
    const root = document.querySelector<HTMLElement>("#app")!;
    mountPinchApp(root, createDependencies(hlsPin));

    submitUrl(root, "https://www.pinterest.com/pin/222222222222222222/");

    await vi.waitFor(() => {
      expect(root.querySelector('[data-testid="error-message"]')?.textContent)
        .toBe("Browser cannot process this HLS stream because Pinterest blocks playlist access.");
    });
  });

  it("shows a human-readable resolver error without a stack trace", async () => {
    const resolver: PinResolver = {
      resolve: vi.fn().mockRejectedValue(
        new PinchError("pin_not_found", "Pin not found"),
      ),
    };
    const root = document.querySelector<HTMLElement>("#app")!;
    mountPinchApp(root, createDependencies(mp4Pin, { resolver }));

    submitUrl(root);

    await vi.waitFor(() => {
      expect(root.querySelector('[data-testid="error-message"]')?.textContent)
        .toBe("Pin not found");
    });
  });

  it("reports a resolved Pin with no source as no-video", async () => {
    const root = document.querySelector<HTMLElement>("#app")!;
    mountPinchApp(root, createDependencies({
      pinId: "123",
      sources: [],
    }));

    submitUrl(root);

    await vi.waitFor(() => {
      expect(root.querySelector('[data-testid="error-message"]')?.textContent)
        .toBe("This Pin does not contain a video");
    });
  });

  it("inserts remote Pin titles as text instead of HTML", async () => {
    const unsafePin: PinVideo = {
      ...mp4Pin,
      title: '<img data-attack src=x onerror="alert(1)">',
    };
    const root = document.querySelector<HTMLElement>("#app")!;
    mountPinchApp(root, createDependencies(unsafePin));

    submitUrl(root);

    await vi.waitFor(() => {
      expect({
        title: root.querySelector('[data-testid="pin-title"]')?.textContent,
        injected: root.querySelector("[data-attack]"),
      }).toEqual({
        title: '<img data-attack src=x onerror="alert(1)">',
        injected: null,
      });
    });
  });

  it("toggles and persists the explicit color theme", () => {
    const root = document.querySelector<HTMLElement>("#app")!;
    mountPinchApp(root, createDependencies());

    root.querySelector<HTMLButtonElement>('[data-testid="theme-toggle"]')?.click();

    expect({
      theme: document.documentElement.dataset.theme,
      stored: localStorage.getItem("pinch-theme"),
    }).toEqual({ theme: "dark", stored: "dark" });
  });

  it("toggles from dark back to light", () => {
    localStorage.setItem("pinch-theme", "dark");
    const root = document.querySelector<HTMLElement>("#app")!;
    mountPinchApp(root, createDependencies());

    root.querySelector<HTMLButtonElement>('[data-testid="theme-toggle"]')?.click();

    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("clears a resolved result so another URL can be used", async () => {
    const root = document.querySelector<HTMLElement>("#app")!;
    mountPinchApp(root, createDependencies());
    submitUrl(root);
    await vi.waitFor(() => {
      expect(root.querySelector('[data-testid="result-card"]')?.hasAttribute("hidden"))
        .toBe(false);
    });

    root.querySelector<HTMLButtonElement>('[data-testid="start-over"]')?.click();

    expect({
      hidden: root.querySelector('[data-testid="result-card"]')?.hasAttribute("hidden"),
      input: root.querySelector<HTMLInputElement>('[data-testid="url-input"]')?.value,
    }).toEqual({ hidden: true, input: "" });
  });

  it("aborts the active resolution when destroyed", async () => {
    let capturedSignal: AbortSignal | undefined;
    const resolver: PinResolver = {
      resolve: vi.fn((_url, options) => {
        capturedSignal = options?.signal;
        return new Promise<PinVideo>(() => undefined);
      }),
    };
    const root = document.querySelector<HTMLElement>("#app")!;
    const app = mountPinchApp(root, createDependencies(mp4Pin, { resolver }));
    submitUrl(root);

    app.destroy();

    expect(capturedSignal?.aborted).toBe(true);
  });
});
