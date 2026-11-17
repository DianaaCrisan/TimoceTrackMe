import { describe, expect, it } from "vitest";
import {
  reconcileOrderLabels,
  type FulfillmentSnapshot,
  type KnownLabel,
  type OrderSnapshot,
} from "./reconcileOrderLabels";

const NOW = new Date("2026-11-17T10:00:00Z");
const ORDER_ID = "gid://shopify/Order/1";

function fulfillment(
  n: number,
  tracking: [string, string | null][],
  status = "SUCCESS",
): FulfillmentSnapshot {
  return {
    id: `gid://shopify/Fulfillment/${n}`,
    status,
    createdAt: new Date(`2026-11-0${n}T08:00:00Z`),
    updatedAt: new Date(`2026-11-0${n}T09:00:00Z`),
    tracking: tracking.map(([number, company]) => ({ number, company })),
  };
}

function order(fulfillments: FulfillmentSnapshot[]): OrderSnapshot {
  return {
    id: ORDER_ID,
    name: "#1001",
    createdAt: new Date("2026-10-30T12:00:00Z"),
    fulfillments,
  };
}

function known(overrides: Partial<KnownLabel> = {}): KnownLabel {
  return {
    trackingNumber: "6256000001",
    source: "TRACKME",
    courier: "OPTIMUS",
    trackingCompany: "Optimus",
    orderId: ORDER_ID,
    orderName: "#1001",
    orderCreatedAt: new Date("2026-10-30T12:00:00Z"),
    fulfillmentId: "gid://shopify/Fulfillment/1",
    status: "USED",
    cancelReason: null,
    cancelledAt: null,
    ...overrides,
  };
}

describe("reconcileOrderLabels", () => {
  it("changes nothing for a TrackMe AWB still on its fulfillment", () => {
    expect(
      reconcileOrderLabels({
        order: order([fulfillment(1, [["6256000001", "Optimus"]])]),
        known: [known()],
        now: NOW,
      }),
    ).toEqual([]);
  });

  it("marks a TrackMe AWB used once its fulfillment exists", () => {
    const [change] = reconcileOrderLabels({
      order: order([fulfillment(1, [["6256000001", "Optimus"]])]),
      known: [
        known({
          status: "CANCELLED",
          cancelReason: "NEVER_ON_SHOPIFY",
          cancelledAt: NOW,
          fulfillmentId: null,
        }),
      ],
      now: NOW,
    });

    expect(change).toMatchObject({
      kind: "update",
      state: {
        status: "USED",
        cancelReason: null,
        cancelledAt: null,
        fulfillmentId: "gid://shopify/Fulfillment/1",
      },
    });
  });

  it("cancels the AWB when its fulfillment is cancelled", () => {
    const [change] = reconcileOrderLabels({
      order: order([fulfillment(1, [["6256000001", "Optimus"]], "CANCELLED")]),
      known: [known()],
      now: NOW,
    });

    expect(change).toMatchObject({
      kind: "update",
      state: {
        status: "CANCELLED",
        cancelReason: "FULFILLMENT_CANCELLED",
        cancelledAt: NOW,
      },
    });
  });

  it("cancels the AWB when its number is removed and the order stays fulfilled (delivered by us)", () => {
    const [change] = reconcileOrderLabels({
      order: order([fulfillment(1, [])]),
      known: [known()],
      now: NOW,
    });

    expect(change).toMatchObject({
      kind: "update",
      state: { status: "CANCELLED", cancelReason: "TRACKING_REMOVED" },
    });
  });

  it("keeps the first cancel date when nothing else changed", () => {
    const cancelledAt = new Date("2026-11-10T10:00:00Z");
    expect(
      reconcileOrderLabels({
        order: order([fulfillment(1, [])]),
        known: [
          known({
            status: "CANCELLED",
            cancelReason: "TRACKING_REMOVED",
            cancelledAt,
          }),
        ],
        now: NOW,
      }),
    ).toEqual([]);
  });

  it("big order re-split: the old AWB is used again on the new fulfillment, the new AWB is used", () => {
    const changes = reconcileOrderLabels({
      order: order([
        fulfillment(1, [["6256000001", "Optimus"]], "CANCELLED"),
        // fulfilled by hand with the copied AWB
        fulfillment(2, [["6256000001", "Optimus"]]),
        // the second parcel, from TrackMe
        fulfillment(3, [["6256000002", "Optimus"]]),
      ]),
      known: [
        known({
          status: "CANCELLED",
          cancelReason: "FULFILLMENT_CANCELLED",
          cancelledAt: new Date("2026-11-02T09:00:00Z"),
        }),
        known({
          trackingNumber: "6256000002",
          status: "CANCELLED",
          cancelReason: "NEVER_ON_SHOPIFY",
          fulfillmentId: null,
        }),
      ],
      now: NOW,
    });

    expect(changes).toEqual([
      expect.objectContaining({
        kind: "update",
        trackingNumber: "6256000001",
        state: expect.objectContaining({
          status: "USED",
          fulfillmentId: "gid://shopify/Fulfillment/2",
          cancelledAt: null,
        }),
      }),
      expect.objectContaining({
        kind: "update",
        trackingNumber: "6256000002",
        state: expect.objectContaining({
          status: "USED",
          fulfillmentId: "gid://shopify/Fulfillment/3",
        }),
      }),
    ]);
  });

  it("adds an AWB pasted by hand with courier Optimus or GLS as used", () => {
    const changes = reconcileOrderLabels({
      order: order([
        fulfillment(1, [["6256000009", "GLS"]]),
        fulfillment(2, [["6256000010", "optimus courier"]]),
      ]),
      known: [],
      now: NOW,
    });

    expect(changes).toEqual([
      {
        kind: "create",
        trackingNumber: "6256000009",
        issuedAt: new Date("2026-11-01T08:00:00Z"),
        state: expect.objectContaining({
          courier: "OPTIMUS",
          trackingCompany: "GLS",
          status: "USED",
          orderName: "#1001",
        }),
      },
      expect.objectContaining({
        trackingNumber: "6256000010",
        state: expect.objectContaining({ courier: "OPTIMUS" }),
      }),
    ]);
  });

  it("adds an AWB with another or no courier as unknown", () => {
    const changes = reconcileOrderLabels({
      order: order([
        fulfillment(1, [["ABC123", "Fan Courier"]]),
        fulfillment(2, [["XYZ789", null]]),
      ]),
      known: [],
      now: NOW,
    });

    expect(changes.map((change) => change.state.courier)).toEqual([
      "UNKNOWN",
      "UNKNOWN",
    ]);
  });

  it("moves a pasted AWB to Optimus once its courier is fixed in Shopify", () => {
    const [change] = reconcileOrderLabels({
      order: order([fulfillment(1, [["6256000009", "GLS"]])]),
      known: [
        known({
          trackingNumber: "6256000009",
          source: "SHOPIFY",
          courier: "UNKNOWN",
          trackingCompany: "Other",
        }),
      ],
      now: NOW,
    });

    expect(change.state).toMatchObject({
      courier: "OPTIMUS",
      trackingCompany: "GLS",
    });
  });

  it("finds an AWB that is only on a cancelled fulfillment and lists it as cancelled", () => {
    const [change] = reconcileOrderLabels({
      order: order([fulfillment(1, [["6256000003", "Optimus"]], "CANCELLED")]),
      known: [],
      now: NOW,
    });

    expect(change).toEqual({
      kind: "create",
      trackingNumber: "6256000003",
      issuedAt: new Date("2026-11-01T08:00:00Z"),
      state: expect.objectContaining({
        status: "CANCELLED",
        cancelReason: "FULFILLMENT_CANCELLED",
        cancelledAt: new Date("2026-11-01T09:00:00Z"),
      }),
    });
  });

  it("never touches an AWB added by hand in the report", () => {
    expect(
      reconcileOrderLabels({
        order: order([fulfillment(1, [])]),
        known: [
          known({
            source: "IMPORT",
            status: "USED",
            fulfillmentId: null,
          }),
        ],
        now: NOW,
      }),
    ).toEqual([]);
  });

  it("leaves an AWB of another order alone when this order only has it on a cancelled fulfillment", () => {
    expect(
      reconcileOrderLabels({
        order: order([
          fulfillment(1, [["6256000001", "Optimus"]], "CANCELLED"),
        ]),
        known: [known({ orderId: "gid://shopify/Order/2" })],
        now: NOW,
      }),
    ).toEqual([]);
  });

  it("keeps a TrackMe AWB as Optimus even if the courier was edited", () => {
    expect(
      reconcileOrderLabels({
        order: order([fulfillment(1, [["6256000001", "Other"]])]),
        known: [known()],
        now: NOW,
      })[0]?.state,
    ).toMatchObject({ courier: "OPTIMUS", trackingCompany: "Other" });
  });
});
