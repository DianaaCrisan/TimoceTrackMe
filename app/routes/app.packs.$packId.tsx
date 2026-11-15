import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { loadOrdersDashboard } from "app/backend/orders/loadOrdersDashboard.server";
import {
  PackRepository,
  toPackView,
} from "app/backend/packs/PackRepository.server";
import { PackService } from "app/backend/packs/PackService.server";
import { formatPackName } from "app/commons/packs/FulfillmentPack";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";
import { OrdersDashboardPage } from "app/frontend/orders-dashboard/components/OrdersDashboardPage";
import { PackSummary } from "app/frontend/packs/components/PackSummary";

/** One pack's orders: the Orders page's tabs and jobs, limited to the pack. */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const record = params.packId ? await PackRepository.get(params.packId) : null;
  if (!record) throw new Response("Pack not found", { status: 404 });

  const pack = toPackView(record);
  const [dashboard, progress] = await Promise.all([
    loadOrdersDashboard({
      admin,
      shop: session.shop,
      url: new URL(request.url),
      scope: { kind: "pack", packId: pack.id },
      packTag: record.orderTag,
    }),
    // closed packs are history: no need to count them on every visit
    pack.status === "CLOSED" ? null : PackService.getProgress(admin, record),
  ]);

  return { ...dashboard, pack, progress };
};

export default function PackRoute() {
  const data = useLoaderData<typeof loader>();
  const { t } = useI18n();

  return (
    <>
      <TitleBar title={formatPackName(data.pack, t)} />
      <OrdersDashboardPage
        // a new pack starts with a fresh selection and tab state
        key={data.pack.id}
        scope={{ kind: "pack", packId: data.pack.id }}
        header={
          <PackSummary
            pack={data.pack}
            progress={data.progress}
            linksToPack={false}
          />
        }
        orders={data.orders}
        pageInfo={data.pageInfo}
        shopAdminUrl={data.shopAdminUrl}
        activeFilter={data.filter}
        ordersCount={data.ordersCount}
        pageNumbers={data.pageNumbers}
        recentJobs={data.recentJobs}
        parcelWeight={data.parcelWeight}
        targetPacks={data.targetPacks}
      />
    </>
  );
}
