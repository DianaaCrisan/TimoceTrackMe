import type { ShopPlanNameQuery } from "app/types/admin.generated";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";

const SHOP_PLAN_NAME_QUERY = `#graphql
  query ShopPlanName {
    shop {
      plan {
        publicDisplayName
      }
    }
  }
`;

/**
 * The shop's Shopify plan as Shopify names it ("Basic", "Grow", "Plus"…),
 * for the Settings page. Null if it could not be read: the page leaves the
 * name out rather than failing.
 */
export async function getShopPlanName(
  admin: AdminApiContextWithoutRest,
): Promise<string | null> {
  try {
    const response = await admin.graphql(SHOP_PLAN_NAME_QUERY);
    const body: { data?: ShopPlanNameQuery } = await response.json();
    return body.data?.shop.plan.publicDisplayName ?? null;
  } catch (error) {
    console.error("AppError[Settings] could not read the shop's plan.", error);
    return null;
  }
}
