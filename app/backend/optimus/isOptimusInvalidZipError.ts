/**
 * Optimus answers `error: 1` for every kind of rejection, so the message is the
 * only way to tell a bad delivery zip apart. Tropical's TrackMe matches the
 * same text against the same Optimus API.
 */
const INVALID_ZIP_MARKER = /delivery zip code/i;

export function isOptimusInvalidZipError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return INVALID_ZIP_MARKER.test(message);
}
