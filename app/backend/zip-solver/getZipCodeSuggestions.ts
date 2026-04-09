import { AddressInput } from "./models/AddressInput";
import { ZipCodeSuggestionRequest } from "./models/ZipCodeSuggestionRequest";
import {
  assertIsZipCodeSuggestionResponseArray,
  ZipCodeSuggestionResponse,
} from "./models/ZipCodeSuggestionResponse";

export async function getZipCodeSuggestions(
  addresses: AddressInput[],
): Promise<ZipCodeSuggestionResponse[]> {
  const ZIP_SOLVER_API_URL = process.env.BULK_ZIP_CODE_SOLVER_API_URL;

  if (!ZIP_SOLVER_API_URL) {
    throw new Error("Missing api url");
  }

  const requestBody: ZipCodeSuggestionRequest = {
    addresses: addresses,
  };
  let response;
  try {
    response = await fetch(ZIP_SOLVER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    throw new Error(
      "Failed to fetch zip code suggestion response via Zip Solver.",
    );
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("API Error:", response.status, errorBody);
    throw new Error(
      `Failed to fetch zip code suggestions: ${response.statusText}`,
    );
  }

  const data = await response.json();
  assertIsZipCodeSuggestionResponseArray(data);
  return data as ZipCodeSuggestionResponse[];
}
