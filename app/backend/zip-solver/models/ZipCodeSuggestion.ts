/**
 * Represents a single validated address suggestion containing the resulting zip code.
 */
export type ZipCodeSuggestion = {
  city: string | null;
  street: string | null;
  postal_code: string | null;
};

export function assertIsZipCodeSuggestion(
  value: unknown,
): asserts value is ZipCodeSuggestion {
  if (typeof value !== "object" || value === null) {
    throw new Error("Value is not an object");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = value as any;

  const isStringOrNull = (val: unknown): val is string | null =>
    typeof val === "string" || val === null;

  if (!isStringOrNull(v.city)) {
    throw new Error("Invalid 'city': must be string or null");
  }

  if (!isStringOrNull(v.street)) {
    throw new Error("Invalid 'street': must be string or null");
  }

  if (!isStringOrNull(v.postal_code)) {
    throw new Error("Invalid 'postal_code': must be string or null");
  }
}
