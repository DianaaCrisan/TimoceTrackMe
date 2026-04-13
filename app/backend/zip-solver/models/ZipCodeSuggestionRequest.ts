import type { AddressInput } from "./AddressInput";

export type ZipCodeSuggestionRequest = {
  /** An array of addresses to find zip codes for. */
  addresses: AddressInput[];
};
