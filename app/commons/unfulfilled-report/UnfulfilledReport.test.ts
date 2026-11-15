import { describe, expect, it } from "vitest";
import { createTranslator } from "../i18n/translate";
import { formatReportScope } from "./UnfulfilledReport";

describe("formatReportScope", () => {
  const t = createTranslator("ro");

  it("names the pack when the report covers one", () => {
    expect(
      formatReportScope(
        {
          interval: { from: null, to: null },
          pack: { id: "p", day: "2026-11-14", daySequence: 2 },
        },
        t,
      ),
    ).toBe("Pachet 14.11.2026/2");
  });

  it("describes the interval otherwise", () => {
    expect(
      formatReportScope({ interval: { from: 1200, to: 1250 }, pack: null }, t),
    ).toBe("Comenzile #1200 – #1250");
  });
});
