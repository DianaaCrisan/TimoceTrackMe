import { afterEach, describe, expect, it, vi } from "vitest";
import { createOptimusTrackingNumber } from "./createOptimusTrackingNumber.server";

vi.mock("./optimus.constants.server", () => ({
  OPTIMUS_API_URL: "https://optimus.test/api",
  OPTIMUS_USERNAME: "user",
  OPTIMUS_API_KEY: "key",
}));

const SHIPPING_DETAILS = {
  orderName: "#1001",
  name: "Ion Pop",
  phoneNumber: "0700000000",
  createdAt: "2026-11-13T10:00:00Z",
  address: "Strada Lunga 1",
  city: "Cluj-Napoca",
  province: "Cluj",
  country: "Romania",
  zip: "400001",
  invoiceDetails: "Comanda #1001",
  weightKg: 12.3456,
  formatted: "",
};

async function sentPayload(
  details: typeof SHIPPING_DETAILS & { parcelPosition?: string },
) {
  const fetchMock = vi.fn(async () =>
    Response.json({ error: 0, id: 1, pcl: ["6001"] }),
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "log").mockImplementation(() => undefined);

  await createOptimusTrackingNumber(details);

  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  return new URLSearchParams(init.body as URLSearchParams);
}

describe("createOptimusTrackingNumber", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the weight in kg, rounded to the gram", async () => {
    const payload = await sentPayload(SHIPPING_DETAILS);

    expect(payload.get("colet_greutate")).toBe("12.346");
    expect(payload.get("colet_buc")).toBe("1");
    expect(payload.get("colet_descriere")).toBe("produse (#1001)");
  });

  it("numbers the parcel in the description", async () => {
    const payload = await sentPayload({
      ...SHIPPING_DETAILS,
      parcelPosition: "2/3",
    });

    expect(payload.get("colet_descriere")).toBe("produse (#1001) 2/3");
  });
});
