import type { authenticate } from "app/shopify.server";

type AdminType = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

export type AdminApiContextWithoutRest = Omit<AdminType, "rest">;
