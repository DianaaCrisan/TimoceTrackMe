import type { OrdersDashboardOrder } from "app/commons/orders/OrdersDashboardOrder";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
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
import "app/frontend/orders-dashboard/components/OrdersDashboardTable/styles.scss";
import "app/frontend/orders-dashboard/components/ZipFixPanel/styles.scss";

type Order = OrdersDashboardOrder;

type ZipFixPanelProps = {
  orders: Order[];
  shopAdminUrl: string;
  /** Another job is starting or the list is reloading. */
  isBusy: boolean;
  isStarting: boolean;
  /** Starts add tracking; resolves to whether the job started. */
  onSubmit: (orderIds: string[], manualZips: ManualZips) => Promise<boolean>;
  /** Shown instead of the submit button when add tracking is not allowed here. */
  blockedNotice?: ReactNode;
  scrollRef?: Ref<HTMLDivElement>;
};

/**
 * The "ZIP to fix" tab: every order add tracking stopped on because of its
 * ZIP, with its address, so the admin can correct the ZIPs in one go and add
 * tracking again with one click.
 *
 * Each row's ZIP starts as the order's current one. Editing a row ticks it;
 * ticked rows are sent, and only edited ZIPs are saved to the orders. Enter
 * and the arrow keys move between rows, so a list can be typed straight down.
 */
export function ZipFixPanel({
  orders,
  shopAdminUrl,
  isBusy,
  isStarting,
  onSubmit,
  scrollRef,
  blockedNotice,
}: ZipFixPanelProps) {
  const { t } = useI18n();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [tickedIds, setTickedIds] = useState<string[]>([]);
  // sent with a job that is still running: locked until the list reloads
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const pendingIdsRef = useRef(pendingIds);
  pendingIdsRef.current = pendingIds;
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // A reload keeps what the admin is typing, except for the orders just sent
  // (their saved ZIP now shows as the current one) and orders that left.
  useEffect(() => {
    const visibleIds = new Set(orders.map((order) => order.id));
    const sentIds = pendingIdsRef.current;
    const keep = (id: string) => visibleIds.has(id) && !sentIds.includes(id);

    setDrafts((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => keep(id))),
    );
    setTickedIds((current) => current.filter(keep));
    setPendingIds([]);
  }, [orders]);

  const currentZip = (order: Order) => order.shippingAddress?.zip ?? "";
  const valueOf = (order: Order) => drafts[order.id] ?? currentZip(order);
  const isEdited = (order: Order) =>
    normalizeZip(valueOf(order)) !== currentZip(order);

  const editableOrders = orders.filter(
    (order) => !pendingIds.includes(order.id),
  );
  const tickedOrders = editableOrders.filter((order) =>
    tickedIds.includes(order.id),
  );
  const invalidCount = tickedOrders.filter(
    (order) => !isValidZip(valueOf(order)),
  ).length;
  const allTicked =
    editableOrders.length > 0 && tickedOrders.length === editableOrders.length;
  const canSubmit = tickedOrders.length > 0 && invalidCount === 0 && !isBusy;

  const handleZipChange = (orderId: string, value: string) => {
    setDrafts((current) => ({ ...current, [orderId]: value }));
    setTickedIds((current) =>
      current.includes(orderId) ? current : [...current, orderId],
    );
  };

  const handleToggle = (orderId: string) => {
    setTickedIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId],
    );
  };

  const handleToggleAll = () => {
    setTickedIds(allTicked ? [] : editableOrders.map((order) => order.id));
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

    const orderIds = tickedOrders.map((order) => order.id);
    const manualZips: ManualZips = Object.fromEntries(
      tickedOrders
        .filter(isEdited)
        .map((order) => [order.id, normalizeZip(valueOf(order))]),
    );

    if (await onSubmit(orderIds, manualZips)) {
      setPendingIds(orderIds);
      setTickedIds((current) => current.filter((id) => !orderIds.includes(id)));
    }
  };

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
          {blockedNotice ?? (
            <button
              type="button"
              className="zip-fix-panel__submit"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              <img src={deliveryIcon} alt="" width={20} height={20} />
              {isStarting
                ? t("dashboard.starting")
                : t("zipFix.submit", { count: tickedOrders.length })}
            </button>
          )}
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
                    checked={allTicked}
                    disabled={editableOrders.length === 0}
                    onChange={handleToggleAll}
                    aria-label={t("zipFix.selectAll")}
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
                const isPending = pendingIds.includes(order.id);
                const isTicked = !isPending && tickedIds.includes(order.id);
                const value = valueOf(order);
                const isInvalid = isTicked && !isValidZip(value);
                const zip = currentZip(order);

                return (
                  <tr
                    key={order.id}
                    className={`orders-dashboard-table__row${
                      isTicked ? " --selected" : ""
                    }${isPending ? " zip-fix-panel__row--pending" : ""}`}
                  >
                    <td className="orders-dashboard-table__checkbox-cell">
                      <input
                        type="checkbox"
                        checked={isTicked}
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
                            }${isEdited(order) ? " --edited" : ""}`}
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
                              handleZipChange(order.id, event.target.value)
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
