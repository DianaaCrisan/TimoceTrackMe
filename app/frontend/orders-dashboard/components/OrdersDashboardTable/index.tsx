import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { Badge } from "app/frontend/core/components/Badge";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";
import { DateUtils } from "app/frontend/core/utils/DateUtils";
import { formatMoney } from "app/frontend/core/utils/money";
import {
  DeliveryMethodTypeDTO,
  formatDeliveryMethodType,
} from "app/frontend/core/utils/deliveryMethod";
import { formatFinancialStatusWithTone } from "app/frontend/core/utils/financialStatus";
import { formatFulfillmentStatusWithTone } from "app/frontend/core/utils/fulfillmentStatus";
import "app/frontend/orders-dashboard/components/OrdersDashboardTable/styles.scss";
import { OrdersDashboardQuery } from "app/types/admin.generated";

type OrdersDashboardTableProps = {
  orders: OrdersDashboardQuery["orders"]["edges"][number]["node"][];
  shopAdminUrl: string;
  selectedOrderIds: string[];
  canSelectMore: boolean;
  allVisibleSelected: boolean;
  onToggleOrder: (orderId: string) => void;
  onToggleAllVisible: () => void;
};

export function OrdersDashboardTable({
  orders,
  shopAdminUrl,
  selectedOrderIds,
  canSelectMore,
  allVisibleSelected,
  onToggleOrder,
  onToggleAllVisible,
}: OrdersDashboardTableProps) {
  const { locale, t } = useI18n();

  return (
    <table className="orders-dashboard-table">
      <thead className="orders-dashboard-table__head">
        <tr>
          <th className="orders-dashboard-table__checkbox-header-cell">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={onToggleAllVisible}
              aria-label={t("table.selectAllVisible")}
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
            const isSelected = selectedOrderIds.includes(order.id);
            const isDisabled = !isSelected && !canSelectMore;

            return (
              <tr
                key={order.id}
                className={`orders-dashboard-table__row
                  ${isSelected ? " --selected" : ""}
                  ${order.cancelledAt ? " --cancelled" : ""}
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
                </td>

                <td className="orders-dashboard-table__body-cell">
                  {DateUtils.formatDate(order.createdAt, locale)}
                </td>

                <td className="orders-dashboard-table__body-cell">
                  {order.customer?.displayName ?? ""}
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
                  {formatDeliveryMethodType(
                    order.fulfillmentOrders.edges[0]?.node?.deliveryMethod
                      ?.methodType,
                    t,
                  )}
                </td>

                <td className="orders-dashboard-table__body-cell">
                  {(() => {
                    const methodType =
                      order.fulfillmentOrders?.edges[0]?.node?.deliveryMethod
                        ?.methodType;
                    const isShipping =
                      methodType === DeliveryMethodTypeDTO.SHIPPING.toString();

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
