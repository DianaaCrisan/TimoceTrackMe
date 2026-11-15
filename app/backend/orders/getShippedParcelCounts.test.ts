import { describe, expect, it, vi } from "vitest";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { runGraphQL } from "../graphql/throttle-handling/helpers/runGraphQL";
import { getShippedParcelCounts } from "./getShippedParcelCounts.server";

vi.mock("../graphql/throttle-handling/helpers/runGraphQL", () => ({
  runGraphQL: vi.fn(),
}));

const admin = {} as AdminApiContextWithoutRest;
const label = (number: string) => ({
  status: "SUCCESS",
  trackingInfo: [{ number }],
});

describe("getShippedParcelCounts", () => {
  it("counts only active fulfillments with a tracking number", async () => {
    vi.mocked(runGraphQL).mockResolvedValue({
      nodes: [
        {
          id: "order-1",
          fulfillments: [
            label("6001"),
            label("6002"),
            { status: "CANCELLED", trackingInfo: [{ number: "6000" }] },
            { status: "SUCCESS", trackingInfo: [] },
          ],
        },
      ],
    } as never);

    const counts = await getShippedParcelCounts(admin, "shop", ["order-1"]);

    expect(counts.get("order-1")).toBe(2);
  });

  it("asks for 10 orders per query", async () => {
    vi.mocked(runGraphQL).mockClear();
    vi.mocked(runGraphQL).mockResolvedValue({ nodes: [] } as never);

    const ids = Array.from({ length: 25 }, (_, index) => `order-${index}`);
    await getShippedParcelCounts(admin, "shop", ids);

    expect(runGraphQL).toHaveBeenCalledTimes(3);
  });
});
