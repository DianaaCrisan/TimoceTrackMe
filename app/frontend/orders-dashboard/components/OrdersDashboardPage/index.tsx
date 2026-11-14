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
import {
  Link,
  useFetcher,
  useLocation,
  useNavigate,
  useRevalidator,
} from "react-router";
import { OrdersDashboardQuery } from "app/types/admin.generated";
import {
  buildOrdersDashboardUrl,
  COUNTED_ORDERS_DASHBOARD_FILTERS,
  formatOrdersDashboardFilter,
  ORDERS_DASHBOARD_FILTERS,
  ORDERS_DASHBOARD_PATH,
  type OrdersDashboardFilter,
} from "app/commons/orders/OrdersDashboardFilter";
import {
  formatTabCount,
  type CountedOrdersDashboardFilter,
  type TabCounts,
} from "app/commons/orders/TabCounts";
import {
  formatShownRange,
  type PageNumbers,
} from "app/commons/pagination/PageNumbers";
import {
  appendOrderSelection,
  type OrderSelection,
} from "app/commons/orders/OrderSelection";
import type { StartJobResponse } from "app/commons/jobs/StartJobResponse";
import {
  formatJobTitle,
  type RecentJobView,
  type RecentJobsSnapshot,
} from "app/commons/jobs/RecentJobView";
import { LOCALE_PARAM } from "app/commons/i18n/Locale";
import type { Translate } from "app/commons/i18n/translate";
import type { TranslationKey } from "app/commons/i18n/translations";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";
import { RecentJobsSection } from "app/frontend/jobs/components/RecentJobsSection";

type BulkJobAction = {
  key: "solve-zip" | "add-tracking" | "print-labels";
  endpoint: string;
  title: TranslationKey;
  icon: string;
  sendsTimeZone: boolean;
};

const BULK_JOB_ACTIONS: BulkJobAction[] = [
  {
    key: "solve-zip",
    endpoint: "/app/orders-dashboard/solve-zip-codes",
    title: "job.solve-zip",
    icon: locationIcon,
    sendsTimeZone: false,
  },
  {
    key: "add-tracking",
    endpoint: "/app/orders-dashboard/add-tracking",
    title: "job.add-tracking",
    icon: deliveryIcon,
    sendsTimeZone: false,
  },
  {
    key: "print-labels",
    endpoint: "/app/orders-dashboard/print-labels",
    title: "job.print-labels",
    icon: printIcon,
    // lets the server stamp the file names with the user's local date/time
    sendsTimeZone: true,
  },
];

type Notice = { tone: "success" | "critical"; message: string };

/**
 * Shopify's order search can lag a few seconds behind a change, so a reload
 * right after a job may still list orders the job just fulfilled or tagged.
 */
const SEARCH_INDEX_CATCH_UP_MS = 5000;

const TAB_COUNTS_URL = `${ORDERS_DASHBOARD_PATH}/tab-counts`;

function isCountedFilter(
  filter: OrdersDashboardFilter,
): filter is CountedOrdersDashboardFilter {
  return (COUNTED_ORDERS_DASHBOARD_FILTERS as readonly string[]).includes(
    filter,
  );
}

type OrdersDashboardPageProps = {
  orders: OrdersDashboardQuery["orders"]["edges"][number]["node"][];
  pageInfo: PageInfo;
  shopAdminUrl: string;
  activeFilter: OrdersDashboardFilter;
  ordersCount: { count: number; isAtLeast: boolean } | null;
  pageNumbers: PageNumbers;
  recentJobs: RecentJobsSnapshot;
};

export function OrdersDashboardPage({
  orders,
  pageInfo,
  shopAdminUrl,
  activeFilter,
  ordersCount,
  pageNumbers,
  recentJobs,
}: OrdersDashboardPageProps) {
  const { locale, t } = useI18n();
  const shopify = useAppBridge();
  const navigate = useNavigate();
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

  // Counted after the page renders, so the order list never waits on them.
  // Reloaded whenever the list is: a job or a page change can move orders
  // between tabs. The previous numbers stay up while new ones load.
  const tabCountsFetcher = useFetcher<TabCounts>();
  const loadTabCountsRef = useRef(tabCountsFetcher.load);
  loadTabCountsRef.current = tabCountsFetcher.load;
  useEffect(() => {
    loadTabCountsRef.current(TAB_COUNTS_URL);
  }, [orders]);

  const renderTabCount = (filter: OrdersDashboardFilter) => {
    if (!isCountedFilter(filter)) return null;

    const tabCounts = tabCountsFetcher.data;
    if (!tabCounts) {
      return <span className="orders-dashboard-page__tab-count">…</span>;
    }

    const count = tabCounts[filter];
    return count ? (
      <span className="orders-dashboard-page__tab-count">
        {formatTabCount(count)}
      </span>
    ) : null;
  };

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
  // the whole tab fits on this page and exactly its orders are ticked, so the
  // selection is the tab even though it was made by hand
  const isWholeTabSelected =
    isFilterSelected ||
    (allVisibleSelected &&
      ordersCount !== null &&
      !ordersCount.isAtLeast &&
      !hasMoreOrdersThanVisible &&
      selectedOrderIds.length === orders.length);

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

  const catchUpTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(catchUpTimerRef.current), []);

  /**
   * A finished job can move orders out of the tab (fulfilled, printed), which
   * leaves the current page's cursor pointing into a list that has changed.
   * So: clear the selection, go back to the tab's first page, and reload once
   * more after the search index has caught up.
   */
  function handleJobFinished(finishedJobs: RecentJobView[]) {
    setSelectedOrderIds([]);
    setIsFilterSelected(false);
    setNotice({
      tone: finishedJobs.some((job) => job.status === "failed" || job.hasErrors)
        ? "critical"
        : "success",
      message: `${finishedJobs
        .map((job) =>
          t(
            job.status === "failed"
              ? "dashboard.jobFailed"
              : "dashboard.jobFinished",
            {
              title: formatJobTitle(job, t),
              details: job.summary ?? job.error ?? "",
            },
          ),
        )
        .join(" · ")}. ${t("dashboard.listRefreshed")}`,
    });

    navigate(buildOrdersDashboardUrl(activeFilter), { replace: true });

    clearTimeout(catchUpTimerRef.current);
    catchUpTimerRef.current = setTimeout(
      () => revalidator.revalidate(),
      SEARCH_INDEX_CATCH_UP_MS,
    );
  }

  async function handleStartJob(action: BulkJobAction) {
    setStartingActionKey(action.key);
    setNotice(null);

    const selection: OrderSelection = isFilterSelected
      ? { mode: "filter", filter: activeFilter }
      : { mode: "ids", orderIds: selectedOrderIds };

    try {
      const formData = new FormData();
      appendOrderSelection(formData, selection);
      // the server answers (and words the job's summary) in this language
      formData.append(LOCALE_PARAM, locale);
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

      const result = await readStartJobResponse(response, t);

      if (result.ok) {
        setNotice({
          tone: "success",
          message: t("dashboard.jobStarted", {
            title: t(action.title),
            count: result.orderCount,
          }),
        });
        setJobsRefreshSignal((signal) => signal + 1);
      } else {
        setNotice({
          tone: "critical",
          message: `${t(action.title)}: ${result.error}`,
        });
      }
    } catch (error) {
      setNotice({
        tone: "critical",
        message: `${t(action.title)}: ${error instanceof Error ? error.message : String(error)}`,
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
            aria-label={t("dashboard.dismiss")}
          >
            ×
          </button>
        </div>
      ) : null}

      <div className="orders-dashboard-page__surface">
        <div className="orders-dashboard-page__toolbar">
          <div className="orders-dashboard-page__tabs">
            {ORDERS_DASHBOARD_FILTERS.map((filter) => (
              <Link
                key={filter}
                to={buildOrdersDashboardUrl(filter)}
                className={`orders-dashboard-page__tab${
                  activeFilter === filter ? " --active" : ""
                }`}
              >
                {formatOrdersDashboardFilter(filter, t)}
                {renderTabCount(filter)}
              </Link>
            ))}
          </div>

          <div className="orders-dashboard-page__toolbar-right">
            {selectedCount > 0 ? (
              <>
                <div className="orders-dashboard-page__bulk-bar-text">
                  {isWholeTabSelected
                    ? t("dashboard.allInTabSelected", {
                        count: selectedCount,
                        tab: formatOrdersDashboardFilter(activeFilter, t),
                      })
                    : t("dashboard.selectedCount", { count: selectedCount })}
                </div>

                {allVisibleSelected &&
                !isFilterSelected &&
                hasMoreOrdersThanVisible ? (
                  isFilterTooLarge ? (
                    <div className="orders-dashboard-page__bulk-bar-hint">
                      {t("dashboard.tabTooLarge", {
                        count: ordersCount?.isAtLeast
                          ? `${filterOrderCount}+`
                          : filterOrderCount,
                        max: MAX_ORDERS_PER_JOB,
                      })}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="orders-dashboard-page__link-button"
                      disabled={isAnyActionBlocked}
                      onClick={handleSelectAllInFilter}
                    >
                      {t("dashboard.selectAllInTab", {
                        count: filterOrderCount,
                      })}
                    </button>
                  )
                ) : null}

                <button
                  type="button"
                  className="orders-dashboard-page__link-button"
                  disabled={isAnyActionBlocked}
                  onClick={handleDeselectAll}
                >
                  {t("dashboard.deselectAll")}
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
                        ? t("dashboard.starting")
                        : t(action.title)}
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
          basePath={ORDERS_DASHBOARD_PATH}
          pageInfo={pageInfo}
          queryParams={{ filter: activeFilter }}
          pageNumbers={pageNumbers}
        />
        <span className="orders-dashboard-page__shown-range">
          {formatShownRange(pageNumbers, orders.length, t)}
        </span>
      </div>

      <div className="orders-dashboard-page__recent-jobs">
        <RecentJobsSection
          initialSnapshot={recentJobs}
          refreshSignal={jobsRefreshSignal}
          onJobFinished={handleJobFinished}
          listMaxHeight="22vh"
        />
      </div>
    </div>
  );
}

/** The server always answers JSON, but a proxy or crash page might not. */
async function readStartJobResponse(
  response: Response,
  t: Translate,
): Promise<StartJobResponse> {
  const contentType = response.headers.get("Content-Type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as StartJobResponse;
  }

  const text = await response.text();
  return {
    ok: false,
    error: text || t("dashboard.httpError", { status: response.status }),
  };
}
