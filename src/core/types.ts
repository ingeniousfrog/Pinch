export type VideoSourceType = "mp4" | "hls";

export interface VideoSource {
  readonly url: string;
  readonly type: VideoSourceType;
  readonly width?: number;
  readonly height?: number;
  readonly bitrate?: number;
  readonly quality?: string;
  readonly codec?: string;
}

export interface PinVideo {
  readonly pinId: string;
  readonly title?: string;
  readonly description?: string;
  readonly thumbnail?: string;
  readonly sources: readonly VideoSource[];
}

export interface ParsedPinUrl {
  readonly pinId: string;
  readonly canonicalUrl: string;
}

export type PinchErrorCode =
  | "invalid_url"
  | "short_url_unsupported"
  | "pin_not_found"
  | "no_video"
  | "cross_origin_blocked"
  | "source_unavailable"
  | "hls_unsupported"
  | "cancelled";

export interface ResolveOptions {
  readonly signal?: AbortSignal;
}

export interface PinResolver {
  resolve(url: string, options?: ResolveOptions): Promise<PinVideo>;
}
