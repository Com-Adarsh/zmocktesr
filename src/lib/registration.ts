import { randomInt } from "node:crypto";

/** `SFI-YYYY-XXXXXX` with a cryptographically random 6-digit suffix. */
export function generateRegistrationId(date = new Date()): string {
  return `SFI-${date.getFullYear()}-${String(randomInt(0, 1_000_000)).padStart(6, "0")}`;
}
