/**
 * ZIP codes the admin typed on the "ZIP to fix" tab, by order ID. Sent with
 * an add tracking job, which saves them to the orders before creating AWBs
 * and never replaces them with the ZIP solver's guess.
 */
export type ManualZips = Record<string, string>;

/** The form field that carries `ManualZips`, as JSON. */
export const MANUAL_ZIPS_FIELD = "manualZips";

/** Romanian postal codes: six digits. Optimus only ships within Romania. */
const ZIP_CODE_PATTERN = /^\d{6}$/;

/** What the admin typed, without the spaces people put in by habit. */
export function normalizeZip(value: string): string {
  return value.replace(/\s+/g, "");
}

export function isValidZip(value: string): boolean {
  return ZIP_CODE_PATTERN.test(normalizeZip(value));
}
