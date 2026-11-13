import { describe, expect, it, vi } from "vitest";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { createJobAdmin } from "./createJobAdmin.server";

vi.mock("app/shopify.server", () => ({ unauthenticated: { admin: vi.fn() } }));

function fakeAdmin(label: string): AdminApiContextWithoutRest {
  return {
    graphql: vi.fn(async () => new Response(label)),
  } as unknown as AdminApiContextWithoutRest;
}

describe("createJobAdmin", () => {
  it("reuses the loaded context within a minute", async () => {
    let now = 0;
    const loadAdmin = vi.fn(async () => fakeAdmin("first"));
    const admin = createJobAdmin("shop.myshopify.com", {
      loadAdmin,
      now: () => now,
    });

    await admin.graphql("query { shop { id } }");
    now = 59_000;
    await admin.graphql("query { shop { id } }");

    expect(loadAdmin).toHaveBeenCalledTimes(1);
    expect(loadAdmin).toHaveBeenCalledWith("shop.myshopify.com");
  });

  it("reloads the context after a minute, so the token gets refreshed", async () => {
    let now = 0;
    const loadAdmin = vi
      .fn()
      .mockResolvedValueOnce(fakeAdmin("first"))
      .mockResolvedValueOnce(fakeAdmin("second"));
    const admin = createJobAdmin("shop", { loadAdmin, now: () => now });

    await admin.graphql("q");
    now = 60_000;
    const response = await admin.graphql("q");

    expect(loadAdmin).toHaveBeenCalledTimes(2);
    expect(await response.text()).toBe("second");
  });

  it("runs one reload for concurrent calls", async () => {
    const loadAdmin = vi.fn(async () => fakeAdmin("only"));
    const admin = createJobAdmin("shop", { loadAdmin, now: () => 0 });

    await Promise.all([
      admin.graphql("a"),
      admin.graphql("b"),
      admin.graphql("c"),
    ]);

    expect(loadAdmin).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failed load", async () => {
    const loadAdmin = vi
      .fn()
      .mockRejectedValueOnce(new Error("session store down"))
      .mockResolvedValueOnce(fakeAdmin("recovered"));
    const admin = createJobAdmin("shop", { loadAdmin, now: () => 0 });

    await expect(admin.graphql("q")).rejects.toThrow("session store down");
    const response = await admin.graphql("q");

    expect(await response.text()).toBe("recovered");
  });
});
