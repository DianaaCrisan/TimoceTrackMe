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
import {
  countSelected,
  getSelectAllBlocker,
  headerCheckboxState,
  isOrderSelected,
  NO_SELECTION,
  toggleAll,
  toggleOrder,
  toOrderSelection,
  type DashboardSelection,
} from "app/commons/orders/DashboardSelection";
import type { OrderRowActivities } from "app/commons/orders/OrderRowActivity";
import type { StartJobResponse } from "app/commons/jobs/StartJobResponse";
import {
  formatJobTitle,
  type RecentJobsSnapshot,
} from "app/commons/jobs/RecentJobView";
import { LOCALE_PARAM } from "app/commons/i18n/Locale";
import type { Translate } from "app/commons/i18n/translate";
import type { TranslationKey } from "app/commons/i18n/translations";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";
import { ActivityBanner } from "app/frontend/jobs/components/ActivityBanner";
import { RecentJobsSection } from "app/frontend/jobs/components/RecentJobsSection";
import {
  BackgroundActivityContext,
  useBackgroundActivity,
  type FinishedWork,
} from "app/frontend/jobs/hooks/useBackgroundActivity";
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
 * Reloads, after this long each, while rows are still greyed out and nothing
 * the page knows of is running: Shopify search catching up after a change
 * no job or batch reports (a new order, another admin's work, a timed-out
 * check). After the last one the page says so instead of reloading forever.
 */
const SETTLE_RELOAD_DELAYS_MS = [3000, 6000, 12000];

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
  /** Rows being changed in the background, greyed out until they settle. */
  rowActivity: OrderRowActivities;
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
  rowActivity,
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

  const [selection, setSelection] = useState<DashboardSelection>(NO_SELECTION);
  const [startingActionKey, setStartingActionKey] = useState<
    BulkJobAction["key"] | null
  >(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isReviewingOrders, setIsReviewingOrders] = useState(false);
  const [pendingTrackingReview, setPendingTrackingReview] =
    useState<PendingTrackingReview | null>(null);
  const [openPackDialog, setOpenPackDialog] = useState<PackDialog | null>(null);

  const activity = useBackgroundActivity({
    initialSnapshot: recentJobs,
    onFinished: handleWorkFinished,
  });
  const packAction = usePackAction(() => {
    setOpenPackDialog(null);
    setSelection(NO_SELECTION);
  }, activity);

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
    setSelection(NO_SELECTION);
  }, [activeFilter]);

  const tabCount = ordersCount?.count ?? 0;
  const selectedCount = countSelected(selection, tabCount);
  const selectAllBlocker = getSelectAllBlocker(ordersCount);
  const canSelectMore =
    selection.kind !== "ids" || selection.ids.length < MAX_ORDERS_PER_JOB;

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
    setSelection((current) => toggleOrder(current, orderId, { tabCount }));
  };

  const handleToggleAll = () => {
    if (selectAllBlocker) return;
    setSelection(toggleAll);
  };

  const handleDeselectAll = () => {
    setSelection(NO_SELECTION);
  };

  // a newer notice restarts the timer, through the cleanup
  useEffect(() => {
    if (notice?.tone !== "success" || notice.link) return;

    const timer = setTimeout(() => setNotice(null), SUCCESS_NOTICE_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  /**
   * Rows still greyed out with nothing running that would settle them: a
   * change no job or batch reports (a new order being tagged, another
   * admin's work) or Shopify search still behind. Looks for running work
   * once, then reloads a few times, further apart, before saying so.
   */
  const settleAttemptRef = useRef(0);
  const [isStillUpdating, setIsStillUpdating] = useState(false);
  const hasBusyRows = Object.keys(rowActivity).length > 0;
  const { isWatching, refresh: refreshActivity } = activity;
  const { revalidate } = revalidator;
  useEffect(() => {
    if (!hasBusyRows || isWatching) {
      settleAttemptRef.current = 0;
      setIsStillUpdating(false);
      return;
    }

    const attempt = settleAttemptRef.current;
    // work started elsewhere (another admin, another tab) shows up here
    if (attempt === 0) refreshActivity();

    const delay = SETTLE_RELOAD_DELAYS_MS[attempt];
    if (delay === undefined) {
      setIsStillUpdating(true);
      return;
    }
    const timer = setTimeout(() => {
      settleAttemptRef.current = attempt + 1;
      revalidate();
    }, delay);
    return () => clearTimeout(timer);
  }, [rowActivity, hasBusyRows, isWatching, refreshActivity, revalidate]);

  /**
   * Work this page waited on is done, and Shopify search already shows it
   * (jobs and tag batches only finish once it does). Reload now:
   * - after a job, from the tab's first page: orders moved out of the tab
   *   (fulfilled, printed), so the page's cursor points into a changed list
   * - after pack tag work, in place
   */
  function handleWorkFinished(finished: FinishedWork) {
    setSelection(NO_SELECTION);

    const zipToFixCount = finished.jobs.reduce(
      (sum, job) => sum + (job.zipToFixCount ?? 0),
      0,
    );
    const hasFailures =
      finished.jobs.some((job) => job.status === "failed" || job.hasErrors) ||
      finished.tagBatches.some((batch) => batch.failedCount > 0);

    const messages = [
      ...finished.jobs.map((job) =>
        t(
          job.status === "failed"
            ? "dashboard.jobFailed"
            : "dashboard.jobFinished",
          {
            title: formatJobTitle(job, t),
            details: job.summary ?? job.error ?? "",
          },
        ),
      ),
      ...finished.tagBatches.map((batch) =>
        batch.failedCount > 0
          ? t("dashboard.tagBatchFailed", { count: batch.failedCount })
          : t("dashboard.tagBatchDone", { count: batch.orderCount }),
      ),
    ];
    if (messages.length > 0) {
      setNotice({
        link:
          zipToFixCount > 0 && activeFilter !== ZIP_TO_FIX_FILTER
            ? {
                label: t("dashboard.fixZips", { count: zipToFixCount }),
                to: buildScopeTabUrl(scope, ZIP_TO_FIX_FILTER),
              }
            : undefined,
        tone: hasFailures ? "critical" : "success",
        message: `${messages.join(" · ")} ${t("dashboard.listRefreshed")}`,
      });
    }

    if (finished.jobs.length > 0) {
      navigate(buildScopeTabUrl(scope, activeFilter), { replace: true });
    } else {
      revalidator.revalidate();
    }
  }

  // add tracking and print labels run on a pack's orders only; the Orders
  // page just lists orders in no pack and adds them to one
  const offersJobs = scope.kind === "pack";

  /** The selection as sent to the server; "all in this tab" stays in the pack. */
  function buildSelection(): OrderSelection | null {
    return toOrderSelection(selection, activeFilter, packId);
  }

  function handleStartJob(action: BulkJobAction) {
    const orderSelection = buildSelection();
    if (!orderSelection) return;

    return action.reviewsOrdersFirst
      ? reviewOrdersThenStart(action, orderSelection)
      : startJob(action, orderSelection);
  }

  /**
   * Checks every selected order (also those on other pages) for customer
   * notes and heavy parcels. With nothing to look at, the job starts at once;
   * otherwise the admin goes through them in a dialog first.
   */
  async function reviewOrdersThenStart(
    action: BulkJobAction,
    orderSelection: OrderSelection,
  ): Promise<void> {
    setStartingActionKey(action.key);
    setIsReviewingOrders(true);
    setNotice(null);

    let result: TrackingReviewResponse;
    let isRequestProblem = false;
    try {
      const formData = new FormData();
      appendOrderSelection(formData, orderSelection);
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
        selection: orderSelection,
      });
      return;
    }

    if (result.ordersToReview.length === 0) {
      await startJob(action, orderSelection);
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
      selection: orderSelection,
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
            ...(packId ? { packId } : {}),
          }
        : pending.selection,
    );
  }

  /** Add tracking for the orders ticked on the ZIP to fix tab. */
  function handleFixZips(orderIds: string[], manualZips: ManualZips) {
    return startJob(
      ADD_TRACKING_ACTION,
      { mode: "ids", orderIds, ...(packId ? { packId } : {}) },
      manualZips,
    );
  }

  /** Adds or moves the selected orders to `target` (a pack ID or a new pack). */
  function handleAddToPack(target: string) {
    const orderSelection = buildSelection();
    if (!orderSelection) return;

    packAction.submit(
      "addOrders",
      { [PACK_ACTION_FIELDS.target]: target },
      (formData) => appendOrderSelection(formData, orderSelection),
    );
  }

  function handleRemoveFromPack() {
    const orderSelection = buildSelection();
    if (!orderSelection) return;

    packAction.submit("removeOrders", {}, (formData) =>
      appendOrderSelection(formData, orderSelection),
    );
  }

  /**
   * Resolves to whether the job started. Once it has, its orders show as
   * being worked on and the banner follows it until it is done.
   */
  async function startJob(
    action: BulkJobAction,
    orderSelection: OrderSelection,
    manualZips?: ManualZips,
  ): Promise<boolean> {
    setStartingActionKey(action.key);
    setNotice(null);

    try {
      const formData = new FormData();
      appendOrderSelection(formData, orderSelection);
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
        setSelection(NO_SELECTION);
        activity.follow({ jobId: result.jobId });
        // shows the job's orders as being worked on
        revalidator.revalidate();
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

  const selectionText =
    selection.kind === "all"
      ? selection.excluded.length === 0
        ? t("dashboard.allInTabSelected", {
            count: selectedCount,
            tab: formatOrdersDashboardFilter(activeFilter, t),
          })
        : t("dashboard.selectedOfTab", {
            count: selectedCount,
            total: tabCount,
            tab: formatOrdersDashboardFilter(activeFilter, t),
          })
      : t("dashboard.selectedCount", { count: selectedCount });

  return (
    <BackgroundActivityContext.Provider value={activity}>
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

        <ActivityBanner snapshot={activity.snapshot} />

        {isStillUpdating ? (
          <div className="orders-dashboard-page__notice --info">
            <span>{t("dashboard.stillUpdating")}</span>
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
                    {selectionText}
                  </div>

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
                isOrderSelected={(orderId) =>
                  isOrderSelected(selection, orderId)
                }
                canSelectMore={canSelectMore}
                rowActivity={rowActivity}
                selectAll={{
                  state: headerCheckboxState(selection),
                  isDisabled:
                    selectAllBlocker !== null || isAnyActionBlocked,
                  disabledReason: formatSelectAllBlocker(
                    selectAllBlocker,
                    ordersCount,
                    t,
                  ),
                }}
                onToggleOrder={handleToggleOrder}
                onToggleAll={handleToggleAll}
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
          <RecentJobsSection activity={activity} listMaxHeight="22vh" />
        </div>
      </div>
    </BackgroundActivityContext.Provider>
  );
}

/** The header checkbox's tooltip when it cannot select the whole tab. */
function formatSelectAllBlocker(
  blocker: ReturnType<typeof getSelectAllBlocker>,
  ordersCount: { count: number; isAtLeast: boolean } | null,
  t: Translate,
): string | null {
  switch (blocker) {
    case "unknown":
      return t("table.selectAllUnknown");
    case "tooMany":
      return t("table.selectAllTooMany", {
        count: ordersCount?.isAtLeast
          ? `${ordersCount.count}+`
          : (ordersCount?.count ?? 0),
        max: MAX_ORDERS_PER_JOB,
      });
    case "empty":
    case null:
      return null;
  }
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
