import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { getOrderNames } from "../orders/getOrderNames.server";
import { completeOrderResultRows } from "./completeOrderResultRows.server";
import type { OrderResultRow } from "./OrderResultRow";

vi.mock("../orders/getOrderNames.server", () => ({
  getOrderNames: vi.fn(),
}));

const admin = {} as AdminApiContextWithoutRest;
const SHOP_URL = "https://admin.shopify.com/store/timoce";

describe("completeOrderResultRows", () => {
  beforeEach(() => {
    vi.mocked(getOrderNames).mockReset();
  });

  it("keeps reported orders, marks the rest skipped, in request order", async () => {
    vi.mocked(getOrderNames).mockResolvedValue(
      new Map([["gid://shopify/Order/2", "#1002"]]),
    );
    const rowsById = new Map<string, OrderResultRow>([
      [
        "gid://shopify/Order/1",
        {
          orderId: "gid://shopify/Order/1",
          orderName: "#1001",
          status: "succeeded",
        },
      ],
    ]);

    const rows = await completeOrderResultRows({
      admin,
      shopUrl: SHOP_URL,
      orderIds: ["gid://shopify/Order/2", "gid://shopify/Order/1"],
      rowsById,
      skippedDetails: "Nothing to do.",
    });

    expect(rows).toEqual([
      {
        orderId: "gid://shopify/Order/2",
        orderName: "#1002",
        status: "skipped",
        details: "Nothing to do.",
      },
      {
        orderId: "gid://shopify/Order/1",
        orderName: "#1001",
        status: "succeeded",
      },
    ]);
    // only the order without a name is looked up
    expect(getOrderNames).toHaveBeenCalledWith(admin, SHOP_URL, [
      "gid://shopify/Order/2",
    ]);
  });

  it("fills in a placeholder name on a reported row", async () => {
    vi.mocked(getOrderNames).mockResolvedValue(
      new Map([["gid://shopify/Order/1", "#1001"]]),
    );

    const rows = await completeOrderResultRows({
      admin,
      shopUrl: SHOP_URL,
      orderIds: ["gid://shopify/Order/1"],
      rowsById: new Map([
        [
          "gid://shopify/Order/1",
          {
            orderId: "gid://shopify/Order/1",
            orderName: "-",
            status: "failed",
            errors: ["boom"],
          },
        ],
      ]),
      skippedDetails: "",
    });

    expect(rows[0]).toMatchObject({ orderName: "#1001", status: "failed" });
  });

  it("reports an order Shopify no longer knows as failed", async () => {
    vi.mocked(getOrderNames).mockResolvedValue(new Map());

    const rows = await completeOrderResultRows({
      admin,
      shopUrl: SHOP_URL,
      orderIds: ["gid://shopify/Order/9"],
      rowsById: new Map(),
      skippedDetails: "",
    });

    expect(rows[0]).toEqual({
      orderId: "gid://shopify/Order/9",
      orderName: "Order 9",
      status: "failed",
      errors: ["Order not found in Shopify."],
    });
  });

  it("uses names the job already loaded before looking any up", async () => {
    vi.mocked(getOrderNames).mockResolvedValue(
      new Map([["gid://shopify/Order/2", "#1002"]]),
    );

    const rows = await completeOrderResultRows({
      admin,
      shopUrl: SHOP_URL,
      orderIds: ["gid://shopify/Order/1", "gid://shopify/Order/2"],
      rowsById: new Map(),
      skippedDetails: "skip",
      knownNamesById: new Map([["gid://shopify/Order/1", "#1001"]]),
    });

    expect(rows.map((row) => [row.orderName, row.status])).toEqual([
      ["#1001", "skipped"],
      ["#1002", "skipped"],
    ]);
    expect(getOrderNames).toHaveBeenCalledWith(admin, SHOP_URL, [
      "gid://shopify/Order/2",
    ]);
  });

  it("makes no lookup when every row already has a name", async () => {
    await completeOrderResultRows({
      admin,
      shopUrl: SHOP_URL,
      orderIds: ["gid://shopify/Order/1"],
      rowsById: new Map([
        [
          "gid://shopify/Order/1",
          {
            orderId: "gid://shopify/Order/1",
            orderName: "#1001",
            status: "succeeded",
          },
        ],
      ]),
      skippedDetails: "",
    });

    expect(getOrderNames).not.toHaveBeenCalled();
  });
});
