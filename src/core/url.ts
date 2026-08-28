import { PinchError } from "./errors";
import type { ParsedPinUrl } from "./types";

const PIN_PATH = /^\/pin\/(\d{1,30})\/?$/;
const PINTEREST_HOST = /^(?:[a-z0-9-]+\.)?pinterest\.(?:com|[a-z]{2}|co\.[a-z]{2})$/i;

const invalidUrl = (): never => {
  throw new PinchError("invalid_url", "Invalid Pinterest URL");
};

export const parsePinterestUrl = (input: string): ParsedPinUrl => {
  const trimmed = input.trim();
  if (!trimmed) {
    return invalidUrl();
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return invalidUrl();
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    !PINTEREST_HOST.test(url.hostname)
  ) {
    return invalidUrl();
  }

  const match = PIN_PATH.exec(url.pathname);
  const pinId = match?.[1];
  if (!pinId) {
    return invalidUrl();
  }

  return {
    pinId,
    canonicalUrl: `https://www.pinterest.com/pin/${pinId}/`,
  };
};
