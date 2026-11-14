import { describe, expect, it, vi } from "vitest";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { runGraphQL } from "../graphql/throttle-handling/helpers/runGraphQL";
import { getOrdersWithCustomerNotes } from "./getOrdersWithCustomerNotes.server";

vi.mock("../graphql/throttle-handling/helpers/runGraphQL", () => ({
  runGraphQL: vi.fn(),
}));

const admin = {} as AdminApiContextWithoutRest;
const gid = (n: number) => `gid://shopify/Order/${n}`;

describe("getOrdersWithCustomerNotes", () => {
  it("returns only orders with a note, reading 50 orders per call", async () => {
    vi.mocked(runGraphQL).mockImplementation(async (...args) => {
      const ids = (args[4] as { ids: string[] }).ids;
      return {
        nodes: ids.map((id) => ({
          id,
          name: `#${id.split("/").pop()}`,
          note: id === gid(2) ? "Nu sunați, scrieți SMS" : null,
          customAttributes: id === gid(60) ? [{ key: "Etaj", value: "4" }] : [],
          customer: { displayName: "Ana Pop" },
        })),
      } as never;
    });

    const orderIds = Array.from({ length: 60 }, (_, index) => gid(index + 1));
    const result = await getOrdersWithCustomerNotes(admin, "shop", orderIds);

    expect(runGraphQL).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      {
        id: gid(2),
        name: "#2",
        customerName: "Ana Pop",
        note: "Nu sunați, scrieți SMS",
        attributes: [],
      },
      {
        id: gid(60),
        name: "#60",
        customerName: "Ana Pop",
        note: null,
        attributes: [{ key: "Etaj", value: "4" }],
      },
    ]);
  });
});
