import { useEffect, useRef, useState } from "react";
import { CursorPagination } from "app/frontend/core/components/CursorPagination";
import { OrdersDashboardTable } from "app/frontend/orders-dashboard/components/OrdersDashboardTable";
import "app/frontend/orders-dashboard/components/OrdersDashboardPage/styles.scss";
import { PageInfo } from "app/types/admin.types";
import { useAppBridge } from "@shopify/app-bridge-react";
import { MAX_ORDERS_PER_JOB } from "app/commons/constants";
import deliveryIcon from "app/frontend/core/icons/DeliveryIcon.svg";
import locationIcon from "app/frontend/core/icons/LocationIcon.svg";
import printIcon from "app/frontend/core/icons/PrintIcon.svg";
import { Link, useLocation, useRevalidator } from "react-router";
import { OrdersDashboardQuery } from "app/types/admin.generated";
import {
  formatOrdersDashboardFilter,
  type OrdersDashboardFilter,
} from "app/commons/orders/OrdersDashboardFilter";
import {
  appendOrderSelection,
  type OrderSelection,
} from "app/commons/orders/OrderSelection";
import type { StartJobResponse } from "app/commons/jobs/StartJobResponse";
import type { RecentJobsSnapshot } from "app/commons/jobs/RecentJobView";
import { RecentJobsSection } from "app/frontend/jobs/components/RecentJobsSection";

type BulkJobAction = {
  key: "solve-zip" | "add-tracking" | "print-labels";
  endpoint: string;
  title: string;
  icon: string;
  sendsTimeZone: boolean;
};

const BULK_JOB_ACTIONS: BulkJobAction[] = [
  {
    key: "solve-zip",
    endpoint: "/app/orders-dashboard/solve-zip-codes",
    title: "Solve ZIP codes",
    icon: locationIcon,
    sendsTimeZone: false,
  },
  {
    key: "add-tracking",
    endpoint: "/app/orders-dashboard/add-tracking",
    title: "Add tracking numbers",
    icon: deliveryIcon,
    sendsTimeZone: false,
  },
  {
    key: "print-labels",
    endpoint: "/app/orders-dashboard/print-labels",
    title: "Print labels",
    icon: printIcon,
    // lets the server stamp the file names with the user's local date/time
    sendsTimeZone: true,
  },
];

type Notice = { tone: "success" | "critical"; message: string };

type OrdersDashboardPageProps = {
  orders: OrdersDashboardQuery["orders"]["edges"][number]["node"][];
  pageInfo: PageInfo;
  shopAdminUrl: string;
  activeFilter: OrdersDashboardFilter;
  ordersCount: { count: number; isAtLeast: boolean } | null;
  recentJobs: RecentJobsSnapshot;
};

export function OrdersDashboardPage({
  orders,
  pageInfo,
  shopAdminUrl,
  activeFilter,
  ordersCount,
  recentJobs,
}: OrdersDashboardPageProps) {
  const shopify = useAppBridge();
  // re-runs the route loader in place, without remounting, so the selection
  // survives and the user can chain jobs (solve ZIP -> add tracking -> labels)
  const revalidator = useRevalidator();
  const isRefreshingOrders = revalidator.state === "loading";

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  // "Select all N orders in this tab": the server resolves the IDs
  const [isFilterSelected, setIsFilterSelected] = useState(false);
  const [startingActionKey, setStartingActionKey] = useState<
    BulkJobAction["key"] | null
  >(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [jobsRefreshSignal, setJobsRefreshSignal] = useState(0);

  // the filter selection means "every order in this tab", so it cannot follow
  // the user to another tab
  useEffect(() => {
    setIsFilterSelected(false);
  }, [activeFilter]);

  const visibleOrderIds = orders.map((order) => order.id);
  const filterOrderCount = ordersCount?.count ?? 0;
  const isFilterTooLarge =
    !ordersCount ||
    ordersCount.isAtLeast ||
    ordersCount.count > MAX_ORDERS_PER_JOB;

  const selectedCount = isFilterSelected
    ? filterOrderCount
    : selectedOrderIds.length;
  const allVisibleSelected =
    isFilterSelected ||
    (orders.length > 0 &&
      orders.every((order) => selectedOrderIds.includes(order.id)));
  const canSelectMore =
    isFilterSelected || selectedOrderIds.length < MAX_ORDERS_PER_JOB;
  const hasMoreOrdersThanVisible = filterOrderCount > orders.length;

  const isAnyActionBlocked = startingActionKey !== null || isRefreshingOrders;

  // reset scroll position when going to the next page
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  useEffect(() => {
    tableScrollRef.current?.scrollTo({ top: 0 });
  }, [location.search]);

  const handleToggleOrder = (orderId: string) => {
    if (isFilterSelected) {
      // unticking one order leaves "all in this tab"; keep the rest of the page
      setIsFilterSelected(false);
      setSelectedOrderIds(visibleOrderIds.filter((id) => id !== orderId));
      return;
    }

    setSelectedOrderIds((currentSelectedIds) => {
      if (currentSelectedIds.includes(orderId)) {
        return currentSelectedIds.filter((id) => id !== orderId);
      }

      if (currentSelectedIds.length >= MAX_ORDERS_PER_JOB) {
        return currentSelectedIds;
      }

      return [...currentSelectedIds, orderId];
    });
  };

  const handleToggleAllVisible = () => {
    if (isFilterSelected) {
      setIsFilterSelected(false);
      setSelectedOrderIds([]);
      return;
    }

    setSelectedOrderIds((currentSelectedIds) => {
      if (allVisibleSelected) {
        return currentSelectedIds.filter((id) => !visibleOrderIds.includes(id));
      }

      const unselectedVisibleIds = visibleOrderIds.filter(
        (id) => !currentSelectedIds.includes(id),
      );
      const remainingSlots = MAX_ORDERS_PER_JOB - currentSelectedIds.length;

      return [
        ...currentSelectedIds,
        ...unselectedVisibleIds.slice(0, Math.max(0, remainingSlots)),
      ];
    });
  };

  const handleSelectAllInFilter = () => {
    setIsFilterSelected(true);
    setSelectedOrderIds([]);
  };

  const handleDeselectAll = () => {
    setIsFilterSelected(false);
    setSelectedOrderIds([]);
  };

  async function handleStartJob(action: BulkJobAction) {
    setStartingActionKey(action.key);
    setNotice(null);

    const selection: OrderSelection = isFilterSelected
      ? { mode: "filter", filter: activeFilter }
      : { mode: "ids", orderIds: selectedOrderIds };

    try {
      const formData = new FormData();
      appendOrderSelection(formData, selection);
      if (action.sendsTimeZone) {
        formData.append(
          "timeZone",
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        );
      }

      const token = await shopify.idToken();
      const response = await fetch(action.endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const result = await readStartJobResponse(response);

      if (result.ok) {
        setNotice({
          tone: "success",
          message: `${action.title} started for ${result.orderCount} order${result.orderCount === 1 ? "" : "s"}. The result will appear under Recent jobs below.`,
        });
        setJobsRefreshSignal((signal) => signal + 1);
      } else {
        setNotice({
          tone: "critical",
          message: `${action.title}: ${result.error}`,
        });
      }
    } catch (error) {
      setNotice({
        tone: "critical",
        message: `${action.title}: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setStartingActionKey(null);
    }
  }

  return (
    <div className="orders-dashboard-page">
      {notice ? (
        <div className={`orders-dashboard-page__notice --${notice.tone}`}>
          <span>{notice.message}</span>
          <button
            type="button"
            className="orders-dashboard-page__notice-close"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}

      <div className="orders-dashboard-page__surface">
        <div className="orders-dashboard-page__toolbar">
          <div className="orders-dashboard-page__tabs">
            <Link
              to="/app/orders-dashboard"
              className={`orders-dashboard-page__tab${
                activeFilter === "all" ? " --active" : ""
              }`}
            >
              All
            </Link>

            <Link
              to="/app/orders-dashboard?filter=pending_fulfillment"
              className={`orders-dashboard-page__tab${
                activeFilter === "pending_fulfillment" ? " --active" : ""
              }`}
            >
              Pending fulfillment
            </Link>
          </div>

          <div className="orders-dashboard-page__toolbar-right">
            {selectedCount > 0 ? (
              <>
                <div className="orders-dashboard-page__bulk-bar-text">
                  {isFilterSelected
                    ? `All ${filterOrderCount} orders in "${formatOrdersDashboardFilter(activeFilter)}" selected`
                    : `${selectedCount} selected`}
                </div>

                {allVisibleSelected &&
                !isFilterSelected &&
                hasMoreOrdersThanVisible ? (
                  isFilterTooLarge ? (
                    <div className="orders-dashboard-page__bulk-bar-hint">
                      {ordersCount?.isAtLeast
                        ? `${filterOrderCount}+`
                        : filterOrderCount}{" "}
                      orders in this tab, more than one job takes (
                      {MAX_ORDERS_PER_JOB})
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="orders-dashboard-page__link-button"
                      disabled={isAnyActionBlocked}
                      onClick={handleSelectAllInFilter}
                    >
                      Select all {filterOrderCount} orders in this tab
                    </button>
                  )
                ) : null}

                <button
                  type="button"
                  className="orders-dashboard-page__link-button"
                  disabled={isAnyActionBlocked}
                  onClick={handleDeselectAll}
                >
                  Deselect all
                </button>

                <div className="orders-dashboard-page__bulk-actions">
                  {BULK_JOB_ACTIONS.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      className="orders-dashboard-page__bulk-action-button"
                      disabled={isAnyActionBlocked}
                      onClick={() => handleStartJob(action)}
                    >
                      <span
                        className="orders-dashboard-page__bulk-action-icon"
                        aria-hidden="true"
                      >
                        <img src={action.icon} alt="" width={20} height={20} />
                      </span>
                      {startingActionKey === action.key
                        ? "Starting..."
                        : action.title}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div
          ref={tableScrollRef}
          className="orders-dashboard-page__table-scroll"
        >
          <OrdersDashboardTable
            orders={orders}
            shopAdminUrl={shopAdminUrl}
            selectedOrderIds={
              isFilterSelected ? visibleOrderIds : selectedOrderIds
            }
            canSelectMore={canSelectMore}
            allVisibleSelected={allVisibleSelected}
            onToggleOrder={handleToggleOrder}
            onToggleAllVisible={handleToggleAllVisible}
          />
        </div>
      </div>

      <div className="orders-dashboard-page__pagination">
        <CursorPagination
          basePath="/app/orders-dashboard"
          pageInfo={pageInfo}
          queryParams={
            activeFilter === "pending_fulfillment"
              ? { filter: "pending_fulfillment" }
              : {}
          }
        />
      </div>

      <div className="orders-dashboard-page__recent-jobs">
        <RecentJobsSection
          initialSnapshot={recentJobs}
          refreshSignal={jobsRefreshSignal}
          // a finished job may have changed ZIPs and fulfillments in the table
          onJobFinished={() => revalidator.revalidate()}
        />
      </div>
    </div>
  );
}

/** The server always answers JSON, but a proxy or crash page might not. */
async function readStartJobResponse(
  response: Response,
): Promise<StartJobResponse> {
  const contentType = response.headers.get("Content-Type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as StartJobResponse;
  }

  const text = await response.text();
  return {
    ok: false,
    error: text || `The server answered with HTTP ${response.status}.`,
  };
}
