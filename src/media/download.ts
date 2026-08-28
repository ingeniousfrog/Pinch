import { PinchError } from "../core/errors";
import type { VideoSource } from "../core/types";
import type { BlobDownloadAction, MediaAccess, Mp4Action } from "./types";

interface ProbeOptions {
  readonly fetcher?: typeof fetch;
  readonly signal?: AbortSignal;
}

interface DownloadRuntime {
  readonly fetcher?: typeof fetch;
  readonly document?: Document;
  readonly createObjectUrl?: (blob: Blob) => string;
  readonly revokeObjectUrl?: (url: string) => void;
  readonly signal?: AbortSignal;
}

const isAbortError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "name" in error &&
  error.name === "AbortError";

export const probeMediaAccess = async (
  url: string,
  options: ProbeOptions = {},
): Promise<MediaAccess> => {
  const fetcher = (options.fetcher ?? globalThis.fetch).bind(globalThis);

  try {
    const response = await fetcher(url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      headers: { Range: "bytes=0-0" },
      ...(options.signal ? { signal: options.signal } : {}),
    });

    if (!response.ok) {
      return "unavailable";
    }

    await response.body?.cancel();
    return "readable";
  } catch (error) {
    if (isAbortError(error)) {
      throw new PinchError("cancelled", "Request cancelled");
    }
    return error instanceof TypeError ? "opaque" : "unavailable";
  }
};

export const createMp4Action = (
  pinId: string,
  source: VideoSource,
  access: MediaAccess,
): Mp4Action => {
  if (source.type !== "mp4" || access === "unavailable" || !/^\d+$/.test(pinId)) {
    throw new PinchError("source_unavailable", "Video source is unavailable");
  }

  if (access === "readable") {
    return {
      kind: "blob-download",
      label: "Download MP4",
      url: source.url,
      filename: `pinch-${pinId}.mp4`,
      help: "Downloads the original MP4 without re-encoding.",
    };
  }

  return {
    kind: "direct-open",
    label: "Open MP4",
    url: source.url,
    help: "Pinterest blocks direct file saving here. Open the original video, then use your browser's save command.",
  };
};

const unavailable = (): never => {
  throw new PinchError("source_unavailable", "Video source is unavailable");
};

export const downloadReadableMp4 = async (
  action: BlobDownloadAction,
  runtime: DownloadRuntime = {},
): Promise<void> => {
  const fetcher = (runtime.fetcher ?? globalThis.fetch).bind(globalThis);
  const targetDocument = runtime.document ?? globalThis.document;
  const createObjectUrl = runtime.createObjectUrl ?? URL.createObjectURL.bind(URL);
  const revokeObjectUrl = runtime.revokeObjectUrl ?? URL.revokeObjectURL.bind(URL);

  let response: Response;
  try {
    response = await fetcher(action.url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      ...(runtime.signal ? { signal: runtime.signal } : {}),
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new PinchError("cancelled", "Request cancelled");
    }
    if (error instanceof TypeError) {
      throw new PinchError(
        "cross_origin_blocked",
        "Pinterest blocked cross-origin access",
      );
    }
    return unavailable();
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.toLowerCase().startsWith("video/mp4")) {
    return unavailable();
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    return unavailable();
  }

  const objectUrl = createObjectUrl(blob);
  try {
    const anchor = targetDocument.createElement("a");
    anchor.href = objectUrl;
    anchor.download = action.filename;
    anchor.rel = "noopener noreferrer";
    anchor.hidden = true;
    targetDocument.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    revokeObjectUrl(objectUrl);
  }
};
