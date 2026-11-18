import type { OrdersDashboardOrder } from "app/commons/orders/OrdersDashboardOrder";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { Badge } from "app/frontend/core/components/Badge";
import { CustomerNoteCell } from "app/frontend/orders-dashboard/components/CustomerNoteCell";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";
import { DateUtils } from "app/frontend/core/utils/DateUtils";
import { formatMoney } from "app/frontend/core/utils/money";
import {
  DeliveryMethodTypeDTO,
  formatDeliveryMethodType,
} from "app/frontend/core/utils/deliveryMethod";
import { formatFinancialStatusWithTone } from "app/frontend/core/utils/financialStatus";
import { formatFulfillmentStatusWithTone } from "app/frontend/core/utils/fulfillmentStatus";
import { WeightCell } from "app/frontend/orders-dashboard/components/WeightCell";
import {
  isOverWeightLimit,
  type ParcelWeightSettings,
} from "app/commons/settings/ParcelWeightSettings";
import type {
  OrderRowActivities,
  OrderRowActivity,
} from "app/commons/orders/OrderRowActivity";
import type { HeaderCheckboxState } from "app/commons/orders/DashboardSelection";
import { formatPackName } from "app/commons/packs/FulfillmentPack";
import type { Translate } from "app/commons/i18n/translate";
import { isTranslationKey } from "app/commons/i18n/translate";
import "app/frontend/orders-dashboard/components/OrdersDashboardTable/styles.scss";

type OrdersDashboardTableProps = {
  orders: OrdersDashboardOrder[];
  shopAdminUrl: string;
  isOrderSelected: (orderId: string) => boolean;
  /** False once the hand-ticked orders reach the job limit. */
  canSelectMore: boolean;
  /** Rows being changed: greyed out, with the reason, and not tickable. */
  rowActivity: OrderRowActivities;
  /** The checkbox that selects every order in the tab, on all pages. */
  selectAll: {
    state: HeaderCheckboxState;
    /** Why it is off, as its tooltip; null when it works. */
    disabledReason: string | null;
    isDisabled: boolean;
  };
  onToggleOrder: (orderId: string) => void;
  onToggleAll: () => void;
  parcelWeight: ParcelWeightSettings;
};

export function OrdersDashboardTable({
  orders,
  shopAdminUrl,
  isOrderSelected,
  canSelectMore,
  rowActivity,
  selectAll,
  onToggleOrder,
  onToggleAll,
  parcelWeight,
}: OrdersDashboardTableProps) {
  const { locale, t } = useI18n();

  return (
    <table className="orders-dashboard-table">
      <thead className="orders-dashboard-table__head">
        <tr>
          <th className="orders-dashboard-table__checkbox-header-cell">
            <input
              type="checkbox"
              checked={selectAll.state === "checked"}
              ref={(input) => {
                if (input) {
                  input.indeterminate = selectAll.state === "indeterminate";
                }
              }}
              disabled={selectAll.isDisabled}
              title={selectAll.disabledReason ?? t("table.selectAllInTab")}
              onChange={onToggleAll}
              aria-label={t("table.selectAllInTab")}
            />
          </th>
          <th className="orders-dashboard-table__header-cell">
            {t("table.order")}
          </th>
          <th className="orders-dashboard-table__header-cell">
            {t("table.date")}
          </th>
          <th className="orders-dashboard-table__header-cell">
            {t("table.customer")}
          </th>
          <th className="orders-dashboard-table__header-cell">
            {t("table.customerNote")}
          </th>
          <th className="orders-dashboard-table__header-cell">
            {t("table.total")}
          </th>
          <th className="orders-dashboard-table__header-cell">
            {t("table.paymentStatus")}
          </th>
          <th className="orders-dashboard-table__header-cell">
            {t("table.fulfillmentStatus")}
          </th>
          <th className="orders-dashboard-table__header-cell">
            {t("table.items")}
          </th>
          <th className="orders-dashboard-table__header-cell">
            {t("table.weight")}
          </th>
          <th className="orders-dashboard-table__header-cell">
            {t("table.deliveryMethod")}
          </th>
          <th className="orders-dashboard-table__header-cell">
            {t("table.zipCode")}
          </th>
        </tr>
      </thead>

      <tbody>
        {orders.length === 0 ? (
          <tr>
            <td colSpan={3} className="orders-dashboard-table__empty-cell">
              {t("table.noOrders")}
            </td>
          </tr>
        ) : (
          orders.map((order) => {
            const activity = rowActivity[order.id];
            // a row being changed is never part of the selection
            const isSelected = !activity && isOrderSelected(order.id);
            const isDisabled =
              Boolean(activity) || (!isSelected && !canSelectMore);
            const isShipping =
              order.fulfillmentOrders.edges[0]?.node?.deliveryMethod
                ?.methodType === DeliveryMethodTypeDTO.SHIPPING.toString();
            // pickup orders get no AWB, so their weight does not matter
            const isHeavy =
              isShipping && isOverWeightLimit(order.weightKg, parcelWeight);
            // once everything shipped, show what happened, not what will
            const shippedParcelCount =
              order.displayFulfillmentStatus === "FULFILLED"
                ? order.shippedParcelCount
                : null;

            return (
              <tr
                key={order.id}
                className={`orders-dashboard-table__row
                  ${isSelected ? " --selected" : ""}
                  ${activity ? " --busy" : ""}
                  ${order.cancelledAt ? " --cancelled" : ""}
                  ${isHeavy && shippedParcelCount === null ? " --heavy" : ""}
                `}
              >
                <td className="orders-dashboard-table__checkbox-cell">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isDisabled}
                    onChange={() => onToggleOrder(order.id)}
                    aria-label={t("table.selectOrder", { name: order.name })}
                  />
                </td>

                <td className="orders-dashboard-table__body-cell">
                  <a
                    href={ShopifyUtils.getOrderAdminUrl(order.id, shopAdminUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="orders-dashboard-table__order-link"
                  >
                    {order.name}
                  </a>
                  {activity ? (
                    <span className="orders-dashboard-table__row-activity">
                      {formatRowActivity(activity, t)}
                    </span>
                  ) : null}
                </td>

                <td className="orders-dashboard-table__body-cell">
                  {DateUtils.formatDate(order.createdAt, locale)}
                </td>

                <td className="orders-dashboard-table__body-cell">
                  {order.customer?.displayName ?? ""}
                </td>

                <td className="orders-dashboard-table__body-cell">
                  <CustomerNoteCell customerNote={order} />
                </td>

                <td className="orders-dashboard-table__body-cell">
                  {formatMoney(
                    order.netPaymentSet.presentmentMoney.amount,
                    order.netPaymentSet.presentmentMoney.currencyCode,
                    locale,
                  )}
                </td>

                <td className="orders-dashboard-table__body-cell">
                  {(() => {
                    const { label, tone } = formatFinancialStatusWithTone(
                      order.displayFinancialStatus,
                      t,
                    );
                    return <Badge tone={tone}>{label}</Badge>;
                  })()}
                </td>

                <td className="orders-dashboard-table__body-cell">
                  {(() => {
                    const { label, tone } = formatFulfillmentStatusWithTone(
                      order.displayFulfillmentStatus,
                      t,
                    );
                    return <Badge tone={tone}>{label}</Badge>;
                  })()}
                </td>

                <td className="orders-dashboard-table__body-cell">
                  {t("table.itemCount", {
                    count: order.currentSubtotalLineItemsQuantity,
                  })}
                </td>

                <td className="orders-dashboard-table__body-cell">
                  <WeightCell
                    weightKg={order.weightKg}
                    isHeavy={isHeavy}
                    shippedParcelCount={shippedParcelCount}
                    parcelWeight={parcelWeight}
                  />
                </td>

                <td className="orders-dashboard-table__body-cell">
                  {formatDeliveryMethodType(
                    order.fulfillmentOrders.edges[0]?.node?.deliveryMethod
                      ?.methodType,
                    t,
                  )}
                </td>

                <td className="orders-dashboard-table__body-cell">
                  {(() => {
                    const zip = order.shippingAddress?.zip;
                    const isMissingZip = isShipping && !zip;

                    if (isMissingZip) {
                      return (
                        <Badge tone="critical">{t("table.missingZip")}</Badge>
                      );
                    }
                    return zip ?? "-";
                  })()}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}

function formatRowActivity(activity: OrderRowActivity, t: Translate): string {
  switch (activity.kind) {
    case "joiningPack":
      return t("row.joiningPack", { pack: formatPackName(activity.pack, t) });
    case "leavingPack":
      return t("row.leavingPack");
    case "inJob": {
      const key = `row.inJob.${activity.job}`;
      return t(isTranslationKey(key) ? key : "row.inJob.other");
    }
    case "stale":
      return t("row.stale");
  }
}
