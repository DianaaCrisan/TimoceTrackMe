import type { OrdersDashboardOrder } from "app/commons/orders/OrdersDashboardOrder";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CursorPagination } from "app/frontend/core/components/CursorPagination";
import { OrdersDashboardTable } from "app/frontend/orders-dashboard/components/OrdersDashboardTable";
import { LoadingBar } from "app/frontend/core/components/LoadingBar";
import type { ParcelWeightSettings } from "app/commons/settings/ParcelWeightSettings";
import "app/frontend/orders-dashboard/components/OrdersDashboardPage/styles.scss";
import { PageInfo } from "app/types/admin.types";
import { useAppBridge } from "@shopify/app-bridge-react";
import { MAX_ORDERS_PER_JOB } from "app/commons/constants";
import deliveryIcon from "app/frontend/core/icons/DeliveryIcon.svg";
import printIcon from "app/frontend/core/icons/PrintIcon.svg";
import {
  Link,
  useFetcher,
  useLocation,
  useNavigate,
  useNavigation,
  useRevalidator,
} from "react-router";
import {
  COUNTED_ORDERS_DASHBOARD_FILTERS,
  formatOrdersDashboardFilter,
  getFilterJobs,
  ORDERS_DASHBOARD_PATH,
  type OrdersDashboardFilter,
  type OrdersDashboardJob,
} from "app/commons/orders/OrdersDashboardFilter";
import {
  buildScopeTabUrl,
  getScopeBasePath,
  getScopeFilters,
  type OrdersScope,
} from "app/commons/orders/OrdersScope";
import type { FulfillmentPackView } from "app/commons/packs/FulfillmentPack";
import { PACK_ACTION_FIELDS } from "app/commons/packs/PackAction";
import { ConfirmDialog } from "app/frontend/core/components/ConfirmDialog";
import { PackPickerDialog } from "app/frontend/packs/components/PackPickerDialog";
import { usePackAction } from "app/frontend/packs/hooks/usePackAction";
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
import { ZipFixPanel } from "app/frontend/orders-dashboard/components/ZipFixPanel";
import {
  MANUAL_ZIPS_FIELD,
  type ManualZips,
} from "app/commons/orders/ManualZips";
import type { TrackingReviewResponse } from "app/commons/orders/TrackingReview";
import {
  TrackingReviewDialog,
  type TrackingReview,
} from "app/frontend/orders-dashboard/components/TrackingReviewDialog";

type BulkJobAction = {
  key: OrdersDashboardJob;
  endpoint: string;
  title: TranslationKey;
  icon: string;
  sendsTimeZone: boolean;
  /**
   * Shows the selected orders that need a look (customer notes, heavy
   * parcels) before the job starts.
   */
  reviewsOrdersFirst: boolean;
};

const ADD_TRACKING_ACTION: BulkJobAction = {
  // also fills in missing ZIP codes before creating the AWBs
  key: "add-tracking",
  endpoint: "/app/orders-dashboard/add-tracking",
  title: "job.add-tracking",
  icon: deliveryIcon,
  sendsTimeZone: false,
  // once tracking is added the order ships, so a note read later is too late
  reviewsOrdersFirst: true,
};

const BULK_JOB_ACTIONS: BulkJobAction[] = [
  ADD_TRACKING_ACTION,
  {
    key: "print-labels",
    endpoint: "/app/orders-dashboard/print-labels",
    title: "job.print-labels",
    icon: printIcon,
    // lets the server stamp the file names with the user's local date/time
    sendsTimeZone: true,
    reviewsOrdersFirst: false,
  },
];

type Notice = {
  tone: "success" | "critical";
  message: string;
  /** A link to where the user can act on the result, e.g. the ZIP to fix tab. */
  link?: { label: string; to: string };
};

/**
 * Shopify's order search can lag a few seconds behind a change, so a reload
 * right after a job may still list orders the job just fulfilled or tagged.
 */
const SEARCH_INDEX_CATCH_UP_MS = 5000;

/**
 * Success notices hide after this long. Errors and notices with a link stay
 * until closed: they ask the admin to read or do something.
 */
const SUCCESS_NOTICE_DISMISS_MS = 8000;

const TRACKING_REVIEW_URL = `${ORDERS_DASHBOARD_PATH}/tracking-review`;

/** A job waiting on the admin to look at the orders it would run on. */
type PendingTrackingReview = {
  review: TrackingReview;
  action: BulkJobAction;
  selection: OrderSelection;
  /** The selection's orders, so some can be left out; unset if unknown. */
  orderIds?: string[];
};

/** Has its own panel instead of the orders table and bulk actions. */
const ZIP_TO_FIX_FILTER: OrdersDashboardFilter = "zip_to_fix";

function isCountedFilter(
  filter: OrdersDashboardFilter,
): filter is CountedOrdersDashboardFilter {
  return (COUNTED_ORDERS_DASHBOARD_FILTERS as readonly string[]).includes(
    filter,
  );
}

/** What the selection's pack buttons open. */
type PackDialog = "add" | "move" | "remove";

type OrdersDashboardPageProps = {
  /** All orders, or one pack's: the tabs, links and "Select all" follow it. */
  scope: OrdersScope;
  /** Shown above the tabs, e.g. the pack's summary. */
  header?: ReactNode;
  /** Packs orders can be added or moved to. */
  targetPacks: FulfillmentPackView[];
  /**
   * Add tracking and print labels only run inside a pack. On the Orders
   * page their buttons give way to a link to the Packs page.
   */
  orders: OrdersDashboardOrder[];
  pageInfo: PageInfo;
  shopAdminUrl: string;
  activeFilter: OrdersDashboardFilter;
  ordersCount: { count: number; isAtLeast: boolean } | null;
  pageNumbers: PageNumbers;
  recentJobs: RecentJobsSnapshot;
  parcelWeight: ParcelWeightSettings;
};

export function OrdersDashboardPage({
  scope,
  header,
  targetPacks,
  orders,
  pageInfo,
  shopAdminUrl,
  activeFilter,
  ordersCount,
  pageNumbers,
  recentJobs,
  parcelWeight,
}: OrdersDashboardPageProps) {
  const { locale, t } = useI18n();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const isRefreshingOrders = revalidator.state === "loading";
  // switching tab or page
  const isNavigating = useNavigation().state !== "idle";

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  // "Select all N orders in this tab": the server resolves the IDs
  const [isFilterSelected, setIsFilterSelected] = useState(false);
  const [startingActionKey, setStartingActionKey] = useState<
    BulkJobAction["key"] | null
  >(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isReviewingOrders, setIsReviewingOrders] = useState(false);
  const [pendingTrackingReview, setPendingTrackingReview] =
    useState<PendingTrackingReview | null>(null);
  const [jobsRefreshSignal, setJobsRefreshSignal] = useState(0);
  const [openPackDialog, setOpenPackDialog] = useState<PackDialog | null>(null);
  const packAction = usePackAction(() => {
    setOpenPackDialog(null);
    setSelectedOrderIds([]);
    setIsFilterSelected(false);
  });

  // Counted after the page renders, so the order list never waits on them.
  // Reloaded whenever the list is: a job or a page change can move orders
  // between tabs. The previous numbers stay up while new ones load.
  const tabCountsFetcher = useFetcher<TabCounts>();
  const loadTabCountsRef = useRef(tabCountsFetcher.load);
  loadTabCountsRef.current = tabCountsFetcher.load;
  const packId = scope.kind === "pack" ? scope.packId : null;
  useEffect(() => {
    loadTabCountsRef.current(
      `${ORDERS_DASHBOARD_PATH}/tab-counts${
        packId ? `?packId=${encodeURIComponent(packId)}` : ""
      }`,
    );
  }, [orders, packId]);

  const renderTabCount = (filter: OrdersDashboardFilter) => {
    if (!isCountedFilter(filter)) return null;

    const tabCounts = tabCountsFetcher.data;
    if (!tabCounts) {
      return <span className="orders-dashboard-page__tab-count">…</span>;
    }

    const count = tabCounts[filter] ?? null;
    // orders waiting on the admin stand out
    const needsAttention =
      filter === ZIP_TO_FIX_FILTER && (count?.count ?? 0) > 0;
    return count ? (
      <span
        className={`orders-dashboard-page__tab-count${
          needsAttention ? " --attention" : ""
        }`}
      >
        {formatTabCount(count)}
      </span>
    ) : null;
  };

  // a selection belongs to the tab it was made in: each tab offers its own
  // jobs, and "every order in this tab" cannot follow the user elsewhere
  useEffect(() => {
    setIsFilterSelected(false);
    setSelectedOrderIds([]);
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

  const isAnyActionBlocked =
    startingActionKey !== null || isRefreshingOrders || packAction.isBusy;
  const isLoading = isAnyActionBlocked || isNavigating;
  const isZipToFixTab = activeFilter === ZIP_TO_FIX_FILTER;

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

  // a newer notice restarts the timer, through the cleanup
  useEffect(() => {
    if (notice?.tone !== "success" || notice.link) return;

    const timer = setTimeout(() => setNotice(null), SUCCESS_NOTICE_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  /**
   * A finished job can move orders out of the tab (fulfilled, printed), which
   * leaves the current page's cursor pointing into a list that has changed.
   * So: clear the selection, go back to the tab's first page, and reload once
   * more after the search index has caught up.
   */
  function handleJobFinished(finishedJobs: RecentJobView[]) {
    setSelectedOrderIds([]);
    setIsFilterSelected(false);
    const zipToFixCount = finishedJobs.reduce(
      (sum, job) => sum + (job.zipToFixCount ?? 0),
      0,
    );
    setNotice({
      link:
        zipToFixCount > 0 && activeFilter !== ZIP_TO_FIX_FILTER
          ? {
              label: t("dashboard.fixZips", { count: zipToFixCount }),
              to: buildScopeTabUrl(scope, ZIP_TO_FIX_FILTER),
            }
          : undefined,
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

    navigate(buildScopeTabUrl(scope, activeFilter), { replace: true });

    clearTimeout(catchUpTimerRef.current);
    catchUpTimerRef.current = setTimeout(
      () => revalidator.revalidate(),
      SEARCH_INDEX_CATCH_UP_MS,
    );
  }

  /** Says which pack a selection was made in, for the server to check. */
  const inPack = packId ? { packId } : {};
  // add tracking and print labels run on a pack's orders only; the Orders
  // page just lists orders in no pack and adds them to one
  const offersJobs = scope.kind === "pack";

  /** The selection as sent to the server; "all in this tab" stays in the pack. */
  function buildSelection(): OrderSelection {
    return isFilterSelected
      ? { mode: "filter", filter: activeFilter, ...inPack }
      : { mode: "ids", orderIds: selectedOrderIds, ...inPack };
  }

  function handleStartJob(action: BulkJobAction) {
    const selection = buildSelection();

    return action.reviewsOrdersFirst
      ? reviewOrdersThenStart(action, selection)
      : startJob(action, selection);
  }

  /**
   * Checks every selected order (also those on other pages) for customer
   * notes and heavy parcels. With nothing to look at, the job starts at once;
   * otherwise the admin goes through them in a dialog first.
   */
  async function reviewOrdersThenStart(
    action: BulkJobAction,
    selection: OrderSelection,
  ): Promise<void> {
    setStartingActionKey(action.key);
    setIsReviewingOrders(true);
    setNotice(null);

    let result: TrackingReviewResponse;
    let isRequestProblem = false;
    try {
      const formData = new FormData();
      appendOrderSelection(formData, selection);
      formData.append(LOCALE_PARAM, locale);

      const token = await shopify.idToken();
      const response = await fetch(TRACKING_REVIEW_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      // 4xx: the selection itself is wrong (empty, too big), as for a job
      isRequestProblem = response.status >= 400 && response.status < 500;
      result = await readJsonResponse<TrackingReviewResponse>(response, t);
    } catch (error) {
      result = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      setIsReviewingOrders(false);
      setStartingActionKey(null);
    }

    if (!result.ok && isRequestProblem) {
      setNotice({
        tone: "critical",
        message: `${t(action.title)}: ${result.error}`,
      });
      return;
    }

    if (!result.ok) {
      setPendingTrackingReview({
        review: {
          kind: "loadFailed",
          error: t("trackingReview.couldNotLoad", { error: result.error }),
        },
        action,
        selection,
      });
      return;
    }

    if (result.ordersToReview.length === 0) {
      await startJob(action, selection);
      return;
    }

    setPendingTrackingReview({
      review: {
        kind: "review",
        ordersToReview: result.ordersToReview,
        orderCount: result.orderIds.length,
        parcelWeightLimitKg: result.parcelWeightLimitKg,
      },
      action,
      selection,
      orderIds: result.orderIds,
    });
  }

  function handleReviewConfirmed(leftOutOrderIds: string[]) {
    const pending = pendingTrackingReview;
    setPendingTrackingReview(null);
    if (!pending) return;

    void startJob(
      pending.action,
      leftOutOrderIds.length > 0 && pending.orderIds
        ? {
            mode: "ids",
            orderIds: pending.orderIds.filter(
              (id) => !leftOutOrderIds.includes(id),
            ),
            ...inPack,
          }
        : pending.selection,
    );
  }

  /** Add tracking for the orders ticked on the ZIP to fix tab. */
  function handleFixZips(orderIds: string[], manualZips: ManualZips) {
    return startJob(
      ADD_TRACKING_ACTION,
      { mode: "ids", orderIds, ...inPack },
      manualZips,
    );
  }

  /** Adds or moves the selected orders to `target` (a pack ID or a new pack). */
  function handleAddToPack(target: string) {
    packAction.submit(
      "addOrders",
      { [PACK_ACTION_FIELDS.target]: target },
      (formData) => appendOrderSelection(formData, buildSelection()),
    );
  }

  function handleRemoveFromPack() {
    packAction.submit("removeOrders", {}, (formData) =>
      appendOrderSelection(formData, buildSelection()),
    );
  }

  /** Resolves to whether the job started. */
  async function startJob(
    action: BulkJobAction,
    selection: OrderSelection,
    manualZips?: ManualZips,
  ): Promise<boolean> {
    setStartingActionKey(action.key);
    setNotice(null);

    try {
      const formData = new FormData();
      appendOrderSelection(formData, selection);
      if (manualZips && Object.keys(manualZips).length > 0) {
        formData.append(MANUAL_ZIPS_FIELD, JSON.stringify(manualZips));
      }
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

      const result = await readJsonResponse<StartJobResponse>(response, t);

      if (result.ok) {
        setNotice({
          tone: "success",
          message: t("dashboard.jobStarted", {
            title: t(action.title),
            count: result.orderCount,
          }),
        });
        setJobsRefreshSignal((signal) => signal + 1);
        return true;
      }

      setNotice({
        tone: "critical",
        message: `${t(action.title)}: ${result.error}`,
      });
      return false;
    } catch (error) {
      setNotice({
        tone: "critical",
        message: `${t(action.title)}: ${error instanceof Error ? error.message : String(error)}`,
      });
      return false;
    } finally {
      setStartingActionKey(null);
    }
  }

  return (
    <div className="orders-dashboard-page">
      {header ? (
        <div className="orders-dashboard-page__header">{header}</div>
      ) : null}

      {notice ? (
        <div className={`orders-dashboard-page__notice --${notice.tone}`}>
          <span>
            {notice.message}
            {notice.link ? (
              <>
                {" "}
                <Link
                  to={notice.link.to}
                  className="orders-dashboard-page__notice-link"
                >
                  {notice.link.label} →
                </Link>
              </>
            ) : null}
          </span>
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
            {getScopeFilters(scope).map((filter) => (
              <Link
                key={filter}
                to={buildScopeTabUrl(scope, filter)}
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
            {selectedCount > 0 && !isZipToFixTab ? (
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
                  {(!offersJobs
                    ? []
                    : BULK_JOB_ACTIONS.filter((action) =>
                        getFilterJobs(activeFilter).includes(action.key),
                      )
                  ).map((action) => (
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
                        ? t(
                            isReviewingOrders
                              ? "trackingReview.checking"
                              : "dashboard.starting",
                          )
                        : t(action.title)}
                    </button>
                  ))}
                  {scope.kind === "all" ? (
                    <button
                      type="button"
                      className="orders-dashboard-page__bulk-action-button"
                      disabled={isAnyActionBlocked}
                      onClick={() => setOpenPackDialog("add")}
                    >
                      {t("pack.action.addToPack")}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="orders-dashboard-page__bulk-action-button"
                        disabled={isAnyActionBlocked}
                        onClick={() => setOpenPackDialog("move")}
                      >
                        {t("pack.action.moveToPack")}
                      </button>
                      <button
                        type="button"
                        className="orders-dashboard-page__bulk-action-button"
                        disabled={isAnyActionBlocked}
                        onClick={() => setOpenPackDialog("remove")}
                      >
                        {t("pack.action.removeFromPack")}
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>

        <LoadingBar isActive={isLoading} label={t("dashboard.loading")} />

        {isZipToFixTab ? (
          <ZipFixPanel
            orders={orders}
            shopAdminUrl={shopAdminUrl}
            isBusy={isAnyActionBlocked}
            isStarting={startingActionKey === ADD_TRACKING_ACTION.key}
            onSubmit={handleFixZips}
            scrollRef={tableScrollRef}
          />
        ) : (
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
              parcelWeight={parcelWeight}
            />
          </div>
        )}
      </div>

      <div className="orders-dashboard-page__pagination">
        <CursorPagination
          basePath={getScopeBasePath(scope)}
          pageInfo={pageInfo}
          queryParams={{ filter: activeFilter }}
          pageNumbers={pageNumbers}
        />
        <span className="orders-dashboard-page__shown-range">
          {formatShownRange(pageNumbers, orders.length, t)}
        </span>
      </div>

      <PackPickerDialog
        isOpen={openPackDialog === "add" || openPackDialog === "move"}
        title={t(
          openPackDialog === "move"
            ? "pack.picker.moveTitle"
            : "pack.picker.addTitle",
          { count: selectedCount },
        )}
        confirmLabel={t(
          openPackDialog === "move"
            ? "pack.action.moveConfirm"
            : "pack.action.addConfirm",
          { count: selectedCount },
        )}
        packs={targetPacks}
        currentPackId={packId ?? undefined}
        isBusy={packAction.isBusy}
        onConfirm={handleAddToPack}
        onCancel={() => setOpenPackDialog(null)}
      />

      <ConfirmDialog
        isOpen={openPackDialog === "remove"}
        title={t("pack.confirm.removeTitle", { count: selectedCount })}
        confirmLabel={t("pack.action.removeFromPack")}
        cancelLabel={t("pack.action.cancel")}
        isConfirmDisabled={packAction.isBusy}
        onConfirm={handleRemoveFromPack}
        onCancel={() => setOpenPackDialog(null)}
      >
        <p>{t("pack.confirm.removeBody")}</p>
      </ConfirmDialog>

      <TrackingReviewDialog
        review={pendingTrackingReview?.review ?? null}
        shopAdminUrl={shopAdminUrl}
        onCancel={() => setPendingTrackingReview(null)}
        onConfirm={handleReviewConfirmed}
      />

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
async function readJsonResponse<T extends { ok: boolean }>(
  response: Response,
  t: Translate,
): Promise<T | { ok: false; error: string }> {
  const contentType = response.headers.get("Content-Type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  const text = await response.text();
  return {
    ok: false,
    error: text || t("dashboard.httpError", { status: response.status }),
  };
}
