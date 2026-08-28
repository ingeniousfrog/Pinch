import type { VideoSource } from "./types";

const incompatibleSource = ({ codec = "", quality = "", url }: VideoSource): boolean =>
  /(?:av01|hevc|hvc1|trial|experimental|v_exp)/i.test(`${codec} ${quality} ${url}`);

const dimensions = ({ height, width }: VideoSource): number => {
  if (width && height) {
    return width * height;
  }

  const knownEdge = width ?? height ?? 0;
  return knownEdge * knownEdge;
};

const qualityNumber = ({ quality = "", url }: VideoSource): number => {
  const match = /(?:^|[_-])(\d{3,4})(?:p|w)?(?:\D|$)/i.exec(`${quality} ${url}`);
  return match?.[1] ? Number(match[1]) : 0;
};

const compareDescending = (left: VideoSource, right: VideoSource): number => {
  const comparisons = [
    Number(right.type === "mp4") - Number(left.type === "mp4"),
    Number(!incompatibleSource(right)) - Number(!incompatibleSource(left)),
    dimensions(right) - dimensions(left),
    (right.bitrate ?? 0) - (left.bitrate ?? 0),
    qualityNumber(right) - qualityNumber(left),
  ];
  const scoreDifference = comparisons.find((value) => value !== 0);

  if (scoreDifference !== undefined) {
    return scoreDifference;
  }

  return left.url < right.url ? -1 : left.url > right.url ? 1 : 0;
};

export const selectBestSource = (
  sources: readonly VideoSource[],
): VideoSource | undefined => [...sources].sort(compareDescending)[0];

