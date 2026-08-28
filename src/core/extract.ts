import { PinchError } from "./errors";
import type { PinVideo, VideoSource, VideoSourceType } from "./types";

type JsonRecord = Readonly<Record<string, unknown>>;

const MAX_JSON_DEPTH = 48;
const VIDEO_HOST = /^v\d*\.pinimg\.com$/i;
const IMAGE_HOST = /^i\.pinimg\.com$/i;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const optionalNumber = (value: unknown): number | undefined => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const sourceType = (url: URL): VideoSourceType | undefined => {
  const pathname = url.pathname.toLowerCase();
  if (pathname.endsWith(".mp4")) {
    return "mp4";
  }
  if (pathname.endsWith(".m3u8")) {
    return "hls";
  }
  return undefined;
};

const normalizeVideoUrl = (
  value: unknown,
): Readonly<{ url: string; type: VideoSourceType }> | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  try {
    const parsed = new URL(value);
    const type = sourceType(parsed);
    if (parsed.protocol !== "https:" || !VIDEO_HOST.test(parsed.hostname) || !type) {
      return undefined;
    }
    parsed.hash = "";
    return { url: parsed.href, type };
  } catch {
    return undefined;
  }
};

const sourceFromRecord = (
  record: JsonRecord,
  qualityHint?: string,
): VideoSource | undefined => {
  const normalized = normalizeVideoUrl(record.url);
  if (!normalized) {
    return undefined;
  }

  const width = optionalNumber(record.width);
  const height = optionalNumber(record.height);
  const bitrate = optionalNumber(record.bitrate ?? record.bitRate ?? record.bandwidth);
  const codec = optionalString(record.codec ?? record.codecs);
  const quality = qualityHint && /^(?:v_|video_)/i.test(qualityHint)
    ? qualityHint
    : undefined;

  return {
    ...normalized,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(bitrate ? { bitrate } : {}),
    ...(quality ? { quality } : {}),
    ...(codec ? { codec } : {}),
  };
};

const sourceFromString = (value: unknown): VideoSource | undefined => {
  const normalized = normalizeVideoUrl(value);
  return normalized ? { ...normalized } : undefined;
};

const collectSources = (
  value: unknown,
  qualityHint?: string,
  depth = 0,
  ancestors: readonly object[] = [],
): readonly VideoSource[] => {
  if (depth > MAX_JSON_DEPTH) {
    return [];
  }

  const direct = sourceFromString(value);
  if (direct) {
    return [direct];
  }

  if (Array.isArray(value)) {
    if (ancestors.includes(value)) {
      return [];
    }
    const nextAncestors = [...ancestors, value];
    return value.flatMap((item) =>
      collectSources(item, undefined, depth + 1, nextAncestors),
    );
  }

  if (!isRecord(value) || ancestors.includes(value)) {
    return [];
  }

  const current = sourceFromRecord(value, qualityHint);
  const nextAncestors = [...ancestors, value];
  const nested = Object.entries(value).flatMap(([key, item]) =>
    key === "url" ? [] : collectSources(item, key, depth + 1, nextAncestors),
  );

  return current ? [current, ...nested] : nested;
};

const mergeSource = (existing: VideoSource, incoming: VideoSource): VideoSource => ({
  url: existing.url,
  type: existing.type,
  ...(existing.width ?? incoming.width
    ? { width: existing.width ?? incoming.width }
    : {}),
  ...(existing.height ?? incoming.height
    ? { height: existing.height ?? incoming.height }
    : {}),
  ...(existing.bitrate ?? incoming.bitrate
    ? { bitrate: existing.bitrate ?? incoming.bitrate }
    : {}),
  ...(existing.quality ?? incoming.quality
    ? { quality: existing.quality ?? incoming.quality }
    : {}),
  ...(existing.codec ?? incoming.codec
    ? { codec: existing.codec ?? incoming.codec }
    : {}),
});

const deduplicateSources = (sources: readonly VideoSource[]): readonly VideoSource[] =>
  sources.reduce<readonly VideoSource[]>((unique, source) => {
    const existing = unique.find(({ url }) => url === source.url);
    if (!existing) {
      return [...unique, source];
    }

    return unique.map((candidate) =>
      candidate.url === source.url ? mergeSource(candidate, source) : candidate,
    );
  }, []);

const findPinRecord = (
  value: unknown,
  pinId: string,
  depth = 0,
  ancestors: readonly object[] = [],
): JsonRecord | undefined => {
  if (depth > MAX_JSON_DEPTH || (!isRecord(value) && !Array.isArray(value))) {
    return undefined;
  }
  if (ancestors.includes(value)) {
    return undefined;
  }
  if (isRecord(value) && String(value.id ?? "") === pinId) {
    return value;
  }

  const nextAncestors = [...ancestors, value];
  const children = Array.isArray(value) ? value : Object.values(value);
  for (const child of children) {
    const found = findPinRecord(child, pinId, depth + 1, nextAncestors);
    if (found) {
      return found;
    }
  }
  return undefined;
};

const firstString = (record: JsonRecord, keys: readonly string[]): string | undefined => {
  for (const key of keys) {
    const result = optionalString(record[key]);
    if (result) {
      return result;
    }
  }
  return undefined;
};

const normalizeImageUrl = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && IMAGE_HOST.test(url.hostname) ? url.href : undefined;
  } catch {
    return undefined;
  }
};

const imageCandidates = (value: unknown): readonly JsonRecord[] => {
  if (!isRecord(value)) {
    return [];
  }
  return Object.values(value).filter(isRecord);
};

const thumbnailFromRecord = (record: JsonRecord): string | undefined => {
  const direct = normalizeImageUrl(record.thumbnail ?? record.image_url);
  if (direct) {
    return direct;
  }

  const bestImage = imageCandidates(record.images).reduce<JsonRecord | undefined>(
    (best, image) => {
      const area = (optionalNumber(image.width) ?? 0) * (optionalNumber(image.height) ?? 0);
      const bestArea = best
        ? (optionalNumber(best.width) ?? 0) * (optionalNumber(best.height) ?? 0)
        : -1;
      return normalizeImageUrl(image.url) && area > bestArea ? image : best;
    },
    undefined,
  );
  return normalizeImageUrl(bestImage?.url);
};

const createPinVideo = (
  pinId: string,
  record: JsonRecord | undefined,
  sources: readonly VideoSource[],
  metadata: Readonly<{
    title?: string;
    description?: string;
    thumbnail?: string;
  }> = {},
): PinVideo => {
  if (sources.length === 0) {
    throw new PinchError("no_video", "This Pin does not contain a video");
  }

  const title = metadata.title ?? (record ? firstString(record, ["title", "grid_title"]) : undefined);
  const description = metadata.description ?? (record
    ? firstString(record, ["description", "closeup_unified_description"])
    : undefined);
  const thumbnail = metadata.thumbnail ?? (record ? thumbnailFromRecord(record) : undefined);

  return {
    pinId,
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(thumbnail ? { thumbnail } : {}),
    sources,
  };
};

export const extractPinVideoFromJson = (payload: unknown, pinId: string): PinVideo => {
  const record = findPinRecord(payload, pinId);
  const extractionRoot = record ?? payload;
  const sources = deduplicateSources(collectSources(extractionRoot));
  return createPinVideo(pinId, record ?? (isRecord(payload) ? payload : undefined), sources);
};

const metaContent = (document: Document, property: string): string | undefined =>
  optionalString(
    document.querySelector<HTMLMetaElement>(
      `meta[property="${property}"], meta[name="${property}"]`,
    )?.content,
  );

const openGraphSource = (document: Document): VideoSource | undefined => {
  const normalized = normalizeVideoUrl(metaContent(document, "og:video"));
  if (!normalized) {
    return undefined;
  }
  const width = optionalNumber(metaContent(document, "og:video:width"));
  const height = optionalNumber(metaContent(document, "og:video:height"));
  return {
    ...normalized,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    quality: "open_graph",
  };
};

const sourcesFromScripts = (document: Document, pinId: string): readonly VideoSource[] =>
  Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="application/json"]'))
    .flatMap((script) => {
      try {
        return extractPinVideoFromJson(JSON.parse(script.textContent ?? ""), pinId).sources;
      } catch {
        return [];
      }
    });

export const extractPinVideoFromHtml = (html: string, pinId: string): PinVideo => {
  const document = new DOMParser().parseFromString(html, "text/html");
  const ogSource = openGraphSource(document);
  const title = metaContent(document, "og:title");
  const description = metaContent(document, "og:description");
  const thumbnail = normalizeImageUrl(metaContent(document, "og:image"));
  const sources = deduplicateSources([
    ...sourcesFromScripts(document, pinId),
    ...(ogSource ? [ogSource] : []),
  ]);

  return createPinVideo(pinId, undefined, sources, {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(thumbnail ? { thumbnail } : {}),
  });
};
