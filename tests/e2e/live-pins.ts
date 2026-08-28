export interface LivePin {
  readonly pinId: string;
  readonly mp4Url: string;
  readonly hlsUrl: string;
}

const readLivePin = (idKey: string, mp4Key: string, hlsKey: string): LivePin | undefined => {
  const pinId = process.env[idKey]?.trim();
  const mp4Url = process.env[mp4Key]?.trim();
  const hlsUrl = process.env[hlsKey]?.trim();
  if (!pinId || !mp4Url || !hlsUrl) {
    return undefined;
  }
  return { pinId, mp4Url, hlsUrl };
};

export const livePins: readonly LivePin[] = [
  readLivePin("PINCH_LIVE_PIN_ID", "PINCH_LIVE_PIN_MP4_URL", "PINCH_LIVE_PIN_HLS_URL"),
  readLivePin("PINCH_LIVE_PIN_2_ID", "PINCH_LIVE_PIN_2_MP4_URL", "PINCH_LIVE_PIN_2_HLS_URL"),
].filter((pin): pin is LivePin => pin !== undefined);

export const primaryLivePin = livePins[0];

export const livePinSkipReason =
  "Set PINCH_LIVE_PIN_ID, PINCH_LIVE_PIN_MP4_URL, and PINCH_LIVE_PIN_HLS_URL to run live Pinterest probes";
