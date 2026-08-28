import type { PinchErrorCode } from "./types";

export class PinchError extends Error {
  readonly code: PinchErrorCode;

  constructor(code: PinchErrorCode, message: string) {
    super(message);
    this.name = "PinchError";
    this.code = code;
  }
}

