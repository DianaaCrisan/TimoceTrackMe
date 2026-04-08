import { useMemo, useState } from "react";
import type { FetcherWithComponents } from "react-router";
import { CursorPagination } from "app/frontend/core/components/CursorPagination";
import { OrdersDashboardTable } from "app/frontend/orders-dashboard/components/OrdersDashboardTable";
import "app/frontend/orders-dashboard/components/OrdersDashboardPage.scss";
import { PageInfo } from "app/types/admin.types";
import { AddTrackingNumbersResult } from "app/backend/add-tracking/addTrackingNumbers.types";

type OrdersDashboardPageProps = {
  orders: {
    id: string;
    name: string;
    createdAt: string;
  }[];
  pageInfo: PageInfo;
  fetcher: FetcherWithComponents<{
    ok: boolean;
    data: AddTrackingNumbersResult;
  }>;
};

const MAX_SELECTED_ORDERS = 10;

export function OrdersDashboardPage({
  orders,
  pageInfo,
  fetcher,
}: OrdersDashboardPageProps) {
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const selectedCount = selectedOrderIds.length;
  const isSubmitting =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  const allVisibleSelected =
    orders.length > 0 &&
    orders.every((order) => selectedOrderIds.includes(order.id));

  const canSelectMore = selectedCount < MAX_SELECTED_ORDERS;

  const handleToggleOrder = (orderId: string) => {
    setSelectedOrderIds((currentSelectedIds) => {
      const isAlreadySelected = currentSelectedIds.includes(orderId);

      if (isAlreadySelected) {
        return currentSelectedIds.filter((id) => id !== orderId);
      }

      if (currentSelectedIds.length >= MAX_SELECTED_ORDERS) {
        return currentSelectedIds;
      }

      return [...currentSelectedIds, orderId];
    });
  };

  const handleToggleAllVisible = () => {
    setSelectedOrderIds((currentSelectedIds) => {
      const visibleOrderIds = orders.map((order) => order.id);

      if (allVisibleSelected) {
        return currentSelectedIds.filter((id) => !visibleOrderIds.includes(id));
      }

      const unselectedVisibleIds = visibleOrderIds.filter(
        (id) => !currentSelectedIds.includes(id),
      );

      const remainingSlots = MAX_SELECTED_ORDERS - currentSelectedIds.length;

      if (remainingSlots <= 0) {
        return currentSelectedIds;
      }

      return [
        ...currentSelectedIds,
        ...unselectedVisibleIds.slice(0, remainingSlots),
      ];
    });
  };

  const selectionSummary = useMemo(() => {
    if (selectedCount === 0) return null;
    return `${selectedCount} selected`;
  }, [selectedCount]);

  const responseContent = useMemo(() => {
    if (!fetcher.data) {
      return null;
    }

    return JSON.stringify(fetcher.data.data, null, 2);
  }, [fetcher.data]);

  return (
    <div className="orders-dashboard-page">
      <div className="orders-dashboard-page__surface">
        <div className="orders-dashboard-page__tabs">
          <button
            type="button"
            className="orders-dashboard-page__tab orders-dashboard-page__tab--active"
          >
            All
          </button>

          <button type="button" className="orders-dashboard-page__tab">
            Pending fulfillment
          </button>
        </div>

        {selectedCount > 0 ? (
          <div className="orders-dashboard-page__bulk-bar">
            <div className="orders-dashboard-page__bulk-bar-text">
              {selectionSummary}
            </div>

            <fetcher.Form method="post">
              {selectedOrderIds.map((orderId) => (
                <input
                  key={orderId}
                  type="hidden"
                  name="selectedOrderIds"
                  value={orderId}
                />
              ))}

              <button
                type="submit"
                className="orders-dashboard-page__bulk-action-button"
                disabled={isSubmitting}
              >
                <span
                  className="orders-dashboard-page__bulk-action-icon"
                  aria-hidden="true"
                >
                  🚚
                </span>
                {isSubmitting
                  ? "Adding tracking numbers..."
                  : "Add tracking numbers"}
              </button>
            </fetcher.Form>
          </div>
        ) : null}

        <OrdersDashboardTable
          orders={orders}
          selectedOrderIds={selectedOrderIds}
          canSelectMore={canSelectMore}
          allVisibleSelected={allVisibleSelected}
          onToggleOrder={handleToggleOrder}
          onToggleAllVisible={handleToggleAllVisible}
        />
      </div>

      <div className="orders-dashboard-page__pagination">
        <CursorPagination
          basePath="/app/orders-dashboard"
          pageInfo={pageInfo}
        />
      </div>

      {responseContent ? (
        <div className="orders-dashboard-page__response">
          <pre className="orders-dashboard-page__response-pre">
            <code>{responseContent}</code>
          </pre>
        </div>
      ) : null}
    </div>
  );
}
