import { PinchError } from "./errors";
import { extractPinVideoFromJson } from "./extract";
import type { PinResolver, PinVideo, ResolveOptions } from "./types";
import { parsePinterestUrl } from "./url";

const WIDGET_ENDPOINT = "https://widgets.pinterest.com/v3/pidgets/pins/info/";

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isAbortError = (error: unknown): boolean =>
  isRecord(error) && error.name === "AbortError";

const widgetPinRecord = (payload: unknown, pinId: string): Readonly<Record<string, unknown>> => {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new PinchError("source_unavailable", "Video source is unavailable");
  }

  const record = payload.data.find(
    (candidate) => isRecord(candidate) && String(candidate.id ?? "") === pinId,
  );
  if (!record) {
    throw new PinchError("pin_not_found", "Pin not found");
  }
  return record;
};

export class BrowserResolver implements PinResolver {
  readonly #fetcher: typeof fetch;

  constructor(fetcher: typeof fetch = globalThis.fetch) {
    this.#fetcher = fetcher.bind(globalThis);
  }

  async resolve(url: string, options: ResolveOptions = {}): Promise<PinVideo> {
    const { pinId } = parsePinterestUrl(url);
    const endpoint = `${WIDGET_ENDPOINT}?pin_ids=${encodeURIComponent(pinId)}`;

    try {
      const response = await this.#fetcher(endpoint, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        headers: { Accept: "application/json" },
        ...(options.signal ? { signal: options.signal } : {}),
      });

      if (response.status === 404) {
        throw new PinchError("pin_not_found", "Pin not found");
      }
      if (!response.ok) {
        throw new PinchError("source_unavailable", "Video source is unavailable");
      }

      const payload: unknown = await response.json();
      return extractPinVideoFromJson(widgetPinRecord(payload, pinId), pinId);
    } catch (error) {
      if (error instanceof PinchError) {
        throw error;
      }
      if (isAbortError(error)) {
        throw new PinchError("cancelled", "Request cancelled");
      }
      if (error instanceof TypeError) {
        throw new PinchError(
          "cross_origin_blocked",
          "Pinterest blocked cross-origin access",
        );
      }
      throw new PinchError("source_unavailable", "Video source is unavailable");
    }
  }
}
