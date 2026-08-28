import type { PinResolver, VideoSource } from "../core/types";
import type { HlsCapability } from "../media/hls-types";
import type { BlobDownloadAction, MediaAccess } from "../media/types";

export interface AppDependencies {
  readonly resolver: PinResolver;
  readonly probeMediaAccess: (
    url: string,
    options?: Readonly<{ signal?: AbortSignal }>,
  ) => Promise<MediaAccess>;
  readonly assessHlsSource: (
    source: VideoSource,
    options?: Readonly<{ signal?: AbortSignal }>,
  ) => Promise<HlsCapability>;
  readonly downloadReadableMp4: (action: BlobDownloadAction) => Promise<void>;
}

export interface MountedApp {
  destroy(): void;
}

