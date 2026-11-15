import { describe, expect, it } from "vitest";
import { createTranslator } from "app/commons/i18n/translate";
import { buildFailureFileName } from "./buildFailureFileName";

describe("buildFailureFileName", () => {
  it("names the failure file in the user's language", () => {
    expect(buildFailureFileName("print-labels", createTranslator("en"))).toBe(
      "FAILED_print-labels.txt",
    );
    expect(buildFailureFileName("add-tracking", createTranslator("ro"))).toBe(
      "ESUAT_adaugare-tracking.txt",
    );
  });
});
