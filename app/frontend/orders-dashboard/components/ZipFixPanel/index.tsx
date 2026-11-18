import type { OrdersDashboardOrder } from "app/commons/orders/OrdersDashboardOrder";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from "react";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { Badge } from "app/frontend/core/components/Badge";
import { CustomerNoteCell } from "app/frontend/orders-dashboard/components/CustomerNoteCell";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";
import deliveryIcon from "app/frontend/core/icons/DeliveryIcon.svg";
import {
  isValidZip,
  normalizeZip,
  type ManualZips,
} from "app/commons/orders/ManualZips";
import {
  countSelected,
  headerCheckboxState,
  isOrderSelected,
  NO_SELECTION,
  toggleAll,
  toggleOrder,
  type DashboardSelection,
} from "app/commons/orders/DashboardSelection";
import type { OrderRowActivities } from "app/commons/orders/OrderRowActivity";
import "app/frontend/orders-dashboard/components/OrdersDashboardTable/styles.scss";
import "app/frontend/orders-dashboard/components/ZipFixPanel/styles.scss";

type Order = OrdersDashboardOrder;

/** A ZIP the admin typed, with the order's ZIP when they started typing. */
type ZipDraft = { value: string; originalZip: string };

type ZipFixPanelProps = {
  orders: Order[];
  shopAdminUrl: string;
  /** Another job is starting or the list is reloading. */
  isBusy: boolean;
  isStarting: boolean;
  /** The tab's order count, for "every order in the tab". */
  ordersCount: { count: number; isAtLeast: boolean } | null;
  /** Why the whole tab cannot be selected (too many, not counted); null if it can. */
  selectAllBlockedReason: string | null;
  isSelectAllBlocked: boolean;
  /** Rows being worked on (add tracking running on them): not tickable. */
  rowActivity: OrderRowActivities;
  /** Starts add tracking; resolves to whether the job started. */
  onSubmit: (
    selection: DashboardSelection,
    manualZips: ManualZips,
  ) => Promise<boolean>;
  scrollRef?: Ref<HTMLDivElement>;
};

/**
 * The "ZIP to fix" tab: every order add tracking stopped on because of its
 * ZIP, with its address, so the admin can correct the ZIPs in one go and add
 * tracking again with one click.
 *
 * Each row's ZIP starts as the order's current one. Editing a row ticks it.
 * Selecting works as on the other tabs: the header checkbox takes every
 * order in the tab, on all pages. ZIPs typed on any page are kept and sent;
 * selected orders whose ZIP was not touched are retried as they are, the
 * ZIP solver trying again.
 *
 * Enter and the arrow keys move between rows, so a list can be typed
 * straight down.
 */
export function ZipFixPanel({
  orders,
  shopAdminUrl,
  isBusy,
  isStarting,
  ordersCount,
  selectAllBlockedReason,
  isSelectAllBlocked,
  rowActivity,
  onSubmit,
  scrollRef,
}: ZipFixPanelProps) {
  const { t } = useI18n();
  // by order, across pages: changing page keeps what was typed
  const [drafts, setDrafts] = useState<Record<string, ZipDraft>>({});
  const [selection, setSelection] = useState<DashboardSelection>(NO_SELECTION);
  // sent with a job that just started: locked until the list reloads and
  // shows them as being worked on
  const [sentIds, setSentIds] = useState<string[]>([]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setSentIds([]);
  }, [orders]);

  const tabCount = ordersCount?.count ?? 0;
  const isRowBusy = (orderId: string) =>
    sentIds.includes(orderId) || Boolean(rowActivity[orderId]);
  const isTicked = (orderId: string) =>
    !isRowBusy(orderId) && isOrderSelected(selection, orderId);

  const currentZip = (order: Order) => order.shippingAddress?.zip ?? "";
  const valueOf = (order: Order) => drafts[order.id]?.value ?? currentZip(order);
  const isDraftEdited = (draft: ZipDraft | undefined) =>
    draft !== undefined && normalizeZip(draft.value) !== draft.originalZip;

  // what would be sent: typed ZIPs of selected orders, on any page
  const editedSelected = Object.entries(drafts).filter(
    ([orderId, draft]) =>
      isOrderSelected(selection, orderId) &&
      !sentIds.includes(orderId) &&
      isDraftEdited(draft),
  );
  const invalidCount = editedSelected.filter(
    ([, draft]) => !isValidZip(draft.value),
  ).length;
  const selectedCount = countSelected(selection, tabCount);
  const fixedCount = editedSelected.length;
  const retriedCount = Math.max(0, selectedCount - fixedCount);
  const canSubmit = selectedCount > 0 && invalidCount === 0 && !isBusy;

  const handleZipChange = (order: Order, value: string) => {
    setDrafts((current) => ({
      ...current,
      [order.id]: {
        value,
        originalZip: current[order.id]?.originalZip ?? currentZip(order),
      },
    }));
    if (!isOrderSelected(selection, order.id)) {
      setSelection((current) => toggleOrder(current, order.id, { tabCount }));
    }
  };

  const handleToggle = (orderId: string) => {
    setSelection((current) => toggleOrder(current, orderId, { tabCount }));
  };

  const handleToggleAll = () => {
    if (isSelectAllBlocked) return;
    setSelection(toggleAll);
  };

  /** Focuses the next ZIP input up or down, skipping rows being processed. */
  const focusNextRow = (fromIndex: number, step: 1 | -1) => {
    for (
      let index = fromIndex + step;
      index >= 0 && index < orders.length;
      index += step
    ) {
      const input = inputRefs.current[index];
      if (input) {
        input.focus();
        input.select();
        return;
      }
    }
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (event.key === "Enter" || event.key === "ArrowDown") {
      event.preventDefault();
      focusNextRow(index, 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusNextRow(index, -1);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const manualZips: ManualZips = Object.fromEntries(
      editedSelected.map(([orderId, draft]) => [
        orderId,
        normalizeZip(draft.value),
      ]),
    );
    const sentSelection = selection;

    if (await onSubmit(sentSelection, manualZips)) {
      setSentIds(
        orders
          .filter((order) => isOrderSelected(sentSelection, order.id))
          .map((order) => order.id),
      );
      // the sent ZIPs are saved to the orders: their own ZIP shows from now on
      setDrafts((current) =>
        Object.fromEntries(
          Object.entries(current).filter(
            ([orderId]) => !isOrderSelected(sentSelection, orderId),
          ),
        ),
      );
      setSelection(NO_SELECTION);
    }
  };

  const headerState = headerCheckboxState(selection);

  return (
    <div className="zip-fix-panel">
      <div className="zip-fix-panel__header">
        <p className="zip-fix-panel__intro">{t("zipFix.intro")}</p>

        <div className="zip-fix-panel__actions">
          {invalidCount > 0 ? (
            <span className="zip-fix-panel__invalid-hint">
              {t("zipFix.invalidCount", { count: invalidCount })}
            </span>
          ) : null}
          {selectedCount > 0 ? (
            <button
              type="button"
              className="orders-dashboard-page__link-button"
              disabled={isBusy}
              onClick={() => setSelection(NO_SELECTION)}
            >
              {t("dashboard.deselectAll")}
            </button>
          ) : null}
          <button
            type="button"
            className="zip-fix-panel__submit"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            <img src={deliveryIcon} alt="" width={20} height={20} />
            {isStarting
              ? t("dashboard.starting")
              : `${t("zipFix.submit", { count: selectedCount })}${
                  selectedCount > 0 && retriedCount > 0
                    ? ` ${t("zipFix.submitBreakdown", {
                        fixed: fixedCount,
                        retried: retriedCount,
                      })}`
                    : ""
                }`}
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="zip-fix-panel__scroll">
        {orders.length === 0 ? (
          <div className="zip-fix-panel__empty">{t("zipFix.empty")}</div>
        ) : (
          <table className="orders-dashboard-table zip-fix-panel__table">
            <thead className="orders-dashboard-table__head">
              <tr>
                <th className="orders-dashboard-table__checkbox-header-cell">
                  <input
                    type="checkbox"
                    checked={headerState === "checked"}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = headerState === "indeterminate";
                      }
                    }}
                    disabled={isSelectAllBlocked || isBusy}
                    title={selectAllBlockedReason ?? t("table.selectAllInTab")}
                    onChange={handleToggleAll}
                    aria-label={t("table.selectAllInTab")}
                  />
                </th>
                <th className="orders-dashboard-table__header-cell">
                  {t("table.order")}
                </th>
                <th className="orders-dashboard-table__header-cell">
                  {t("table.customer")}
                </th>
                <th className="orders-dashboard-table__header-cell">
                  {t("table.customerNote")}
                </th>
                <th className="orders-dashboard-table__header-cell">
                  {t("zipFix.colAddress")}
                </th>
                <th className="orders-dashboard-table__header-cell">
                  {t("zipFix.colCity")}
                </th>
                <th className="orders-dashboard-table__header-cell">
                  {t("zipFix.colCounty")}
                </th>
                <th className="orders-dashboard-table__header-cell">
                  {t("zipFix.colProblem")}
                </th>
                <th className="orders-dashboard-table__header-cell">
                  {t("zipFix.colCorrectZip")}
                </th>
              </tr>
            </thead>

            <tbody>
              {orders.map((order, index) => {
                const address = order.shippingAddress;
                const isPending = isRowBusy(order.id);
                const isRowTicked = isTicked(order.id);
                const value = valueOf(order);
                const isEdited = isDraftEdited(drafts[order.id]);
                // only a typed ZIP is checked; an untouched one is retried
                const isInvalid = isRowTicked && isEdited && !isValidZip(value);
                const zip = currentZip(order);

                return (
                  <tr
                    key={order.id}
                    className={`orders-dashboard-table__row${
                      isRowTicked ? " --selected" : ""
                    }${isPending ? " zip-fix-panel__row--pending" : ""}`}
                  >
                    <td className="orders-dashboard-table__checkbox-cell">
                      <input
                        type="checkbox"
                        checked={isRowTicked}
                        disabled={isPending}
                        onChange={() => handleToggle(order.id)}
                        aria-label={t("table.selectOrder", {
                          name: order.name,
                        })}
                      />
                    </td>

                    <td className="orders-dashboard-table__body-cell">
                      <a
                        href={ShopifyUtils.getOrderAdminUrl(
                          order.id,
                          shopAdminUrl,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="orders-dashboard-table__order-link"
                      >
                        {order.name}
                      </a>
                    </td>

                    <td className="orders-dashboard-table__body-cell">
                      {order.customer?.displayName ?? ""}
                    </td>

                    <td className="orders-dashboard-table__body-cell">
                      {/* customers sometimes write the right address or ZIP here */}
                      <CustomerNoteCell customerNote={order} />
                    </td>

                    <td className="orders-dashboard-table__body-cell zip-fix-panel__address">
                      {[address?.address1, address?.address2]
                        .filter(Boolean)
                        .join(", ") || "-"}
                    </td>

                    <td className="orders-dashboard-table__body-cell">
                      {address?.city || "-"}
                    </td>

                    <td className="orders-dashboard-table__body-cell">
                      {address?.province || "-"}
                    </td>

                    <td className="orders-dashboard-table__body-cell">
                      {zip ? (
                        <Badge tone="warning">
                          {t("zipFix.problemRejected", { zip })}
                        </Badge>
                      ) : (
                        <Badge tone="critical">
                          {t("zipFix.problemMissing")}
                        </Badge>
                      )}
                    </td>

                    <td className="orders-dashboard-table__body-cell">
                      {isPending ? (
                        <span className="zip-fix-panel__pending">
                          {t("zipFix.inProgress")}
                        </span>
                      ) : (
                        <div className="zip-fix-panel__zip-cell">
                          <input
                            ref={(element) => {
                              inputRefs.current[index] = element;
                            }}
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            maxLength={8}
                            className={`zip-fix-panel__zip-input${
                              isInvalid ? " --invalid" : ""
                            }${isEdited ? " --edited" : ""}`}
                            value={value}
                            placeholder="000000"
                            title={
                              isInvalid ? t("zipFix.invalidZip") : undefined
                            }
                            aria-invalid={isInvalid}
                            aria-label={t("zipFix.zipInputLabel", {
                              name: order.name,
                            })}
                            onChange={(event) =>
                              handleZipChange(order, event.target.value)
                            }
                            onKeyDown={(event) => handleKeyDown(event, index)}
                          />
                          <a
                            href={buildZipSearchUrl(order)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="zip-fix-panel__search-link"
                            title={t("zipFix.searchTitle")}
                          >
                            {t("zipFix.search")}
                          </a>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** A Google search for the address's postal code, in Romanian. */
function buildZipSearchUrl(order: Order): string {
  const address = order.shippingAddress;
  const parts = [
    address?.address1,
    address?.address2,
    address?.city,
    address?.province,
  ].filter(Boolean);

  return `https://www.google.com/search?q=${encodeURIComponent(
    `cod poștal ${parts.join(", ")}`,
  )}`;
}
