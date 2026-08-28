import { PinchError } from "../core/errors";
import type { VideoSource } from "../core/types";
import type { HlsCapability } from "./hls-types";

interface HlsOptions {
  readonly fetcher?: typeof fetch;
  readonly signal?: AbortSignal;
}

const isAbortError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "name" in error &&
  error.name === "AbortError";

const unavailable = (): never => {
  throw new PinchError("source_unavailable", "Video source is unavailable");
};

export const assessHlsSource = async (
  source: VideoSource,
  options: HlsOptions = {},
): Promise<HlsCapability> => {
  if (source.type !== "hls") {
    return unavailable();
  }

  const fetcher = (options.fetcher ?? globalThis.fetch).bind(globalThis);
  let response: Response;
  try {
    response = await fetcher(source.url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new PinchError("cancelled", "Request cancelled");
    }
    if (error instanceof TypeError) {
      return {
        kind: "blocked",
        message: "Browser cannot process this HLS stream because Pinterest blocks playlist access.",
      };
    }
    return unavailable();
  }

  if (!response.ok) {
    return unavailable();
  }

  const playlist = await response.text();
  if (!playlist.trimStart().startsWith("#EXTM3U")) {
    return unavailable();
  }

  return {
    kind: "unsupported",
    message: "This HLS stream is readable, but its no-transcode MP4 remux path has not been verified.",
  };
};
