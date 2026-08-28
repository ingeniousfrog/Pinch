export type MediaAccess = "readable" | "opaque" | "unavailable";

export interface BlobDownloadAction {
  readonly kind: "blob-download";
  readonly label: "Download MP4";
  readonly url: string;
  readonly filename: string;
  readonly help: string;
}

export interface DirectOpenAction {
  readonly kind: "direct-open";
  readonly label: "Open MP4";
  readonly url: string;
  readonly help: string;
}

export type Mp4Action = BlobDownloadAction | DirectOpenAction;

