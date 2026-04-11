import type { ConfidenceLevel } from "./ConfidenceLevel";
import {
  assertIsZipCodeSuggestion,
  type ZipCodeSuggestion,
} from "./ZipCodeSuggestion";

/**
 * The complete result for a single address lookup, including confidence and suggestions.
 */
export type ZipCodeSuggestionResponse = {
  /** OrderId: The unique identifier passed in the original request. */
  orderId: string;
  /** The confidence score for the returned suggestions. */
  confidence: ConfidenceLevel;
  /** An array of potential address matches with their zip codes. */
  suggestions: ZipCodeSuggestion[];
  /** An optional reason for the given confidence level (e.g., "Partial match"). */
  reason: string | null;
  /** A description of any error that occurred during the lookup. */
  error: string | null;
};

export function assertIsZipCodeSuggestionResponse(
  value: unknown,
): asserts value is ZipCodeSuggestionResponse {
  if (typeof value !== "object" || value === null) {
    throw new Error("Zip solver: value is not an object.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = value as any;

  // Basic type checks
  if (typeof v.orderId !== "string") {
    throw new Error("Invalid or missing 'orderId'");
  }

  if (typeof v.confidence !== "string") {
    throw new Error("Invalid or missing 'confidence'");
  }

  if (!Array.isArray(v.suggestions)) {
    throw new Error("'suggestions' must be an array");
  }

  // Validate each suggestion
  v.suggestions.forEach((s: unknown, index: number) => {
    try {
      assertIsZipCodeSuggestion(s);
    } catch (err) {
      throw new Error(
        `Invalid suggestion at index ${index}: ${(err as Error).message}`,
      );
    }
  });

  if (v.reason !== null && typeof v.reason !== "string") {
    throw new Error("'reason' must be a string or null");
  }

  if (v.error !== null && typeof v.error !== "string") {
    throw new Error("'error' must be a string or null");
  }
}

export function assertIsZipCodeSuggestionResponseArray(
  value: unknown,
): asserts value is ZipCodeSuggestionResponse[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected an array of ZipCodeSuggestionResponse");
  }

  value.forEach((item, index) => {
    try {
      assertIsZipCodeSuggestionResponse(item);
    } catch (err) {
      throw new Error(
        `Invalid ZipCodeSuggestionResponse at index ${index}: ${
          (err as Error).message
        }`,
      );
    }
  });
}
