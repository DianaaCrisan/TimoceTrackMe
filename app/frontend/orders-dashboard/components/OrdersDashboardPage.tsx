import { CursorPagination } from "app/frontend/core/components/CursorPagination";
import { OrdersDashboardTable } from "app/frontend/orders-dashboard/components/OrdersDashboardTable";
import "app/frontend/orders-dashboard/components/OrdersDashboardPage.scss";
import { PageInfo } from "app/types/admin.types";

type OrdersDashboardPageProps = {
  orders: {
    id: string;
    name: string;
    createdAt: string;
  }[];
  pageInfo: PageInfo;
};

export function OrdersDashboardPage({
  orders,
  pageInfo,
}: OrdersDashboardPageProps) {
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

        <OrdersDashboardTable orders={orders} />
      </div>

      <div className="orders-dashboard-page__pagination">
        <CursorPagination
          basePath="/app/orders-dashboard"
          pageInfo={pageInfo}
        />
      </div>
    </div>
  );
}
