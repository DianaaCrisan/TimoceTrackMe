import { describe, expect, it, vi } from "vitest";
import { authenticate } from "app/shopify.server";

// What the Shopify library does with a preflight: answers it at once.
vi.mock("app/shopify.server", () => ({
  authenticate: {
    admin: vi.fn(async (request: Request) => {
      if (request.method === "OPTIONS") {
        throw new Response(null, {
          status: 204,
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      }
      return { cors: (response: Response) => response };
    }),
  },
}));

/**
 * The routes the order page's extensions call. They run on another origin
 * and send an Authorization header, so every call starts with an OPTIONS
 * preflight, which React Router hands to the route's loader. A route with
 * only an action fails its preflight in production (development hides it:
 * Vite adds CORS headers to everything).
 */
const extensionRoutes = import.meta.glob<{ loader?: unknown }>(
  "../../routes/api.order-actions.*.ts",
);

describe("order page extension routes", () => {
  const routeFiles = Object.keys(extensionRoutes);

  it("finds the routes", () => {
    expect(routeFiles).toEqual(
      expect.arrayContaining([
        "../../routes/api.order-actions.add-tracking.ts",
        "../../routes/api.order-actions.summary.ts",
        "../../routes/api.order-actions.label.ts",
      ]),
    );
  });

  it.each(routeFiles)("%s answers the CORS preflight", async (file) => {
    const route = await extensionRoutes[file]();
    expect(typeof route.loader).toBe("function");

    const preflight = new Request(
      "https://timocetrackme.onrender.com/api/order-actions/x",
      {
        method: "OPTIONS",
        headers: { Origin: "https://extensions.shopifycdn.com" },
      },
    );
    const loader = route.loader as (args: {
      request: Request;
    }) => Promise<Response>;
    const response = await loader({ request: preflight }).catch(
      (thrown: unknown) => thrown,
    );

    expect(authenticate.admin).toHaveBeenCalledWith(preflight);
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(204);
    expect(
      (response as Response).headers.get("Access-Control-Allow-Origin"),
    ).toBe("*");
  });
});
