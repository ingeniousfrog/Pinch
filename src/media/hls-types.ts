export interface BlockedHlsCapability {
  readonly kind: "blocked";
  readonly message: string;
}

export interface UnsupportedHlsCapability {
  readonly kind: "unsupported";
  readonly message: string;
}

export type HlsCapability = BlockedHlsCapability | UnsupportedHlsCapability;

