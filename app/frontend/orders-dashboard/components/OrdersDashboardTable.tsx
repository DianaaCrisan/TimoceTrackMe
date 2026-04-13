import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { Badge } from "app/frontend/core/components/Badge";
import { DateUtils } from "app/frontend/core/utils/DateUtils";
import {
  DeliveryMethodTypeDTO,
  formatDeliveryMethodType,
} from "app/frontend/core/utils/deliveryMethod";
import { formatFinancialStatusWithTone } from "app/frontend/core/utils/financialStatus";
import { formatFulfillmentStatusWithTone } from "app/frontend/core/utils/fulfillmentStatus";
import "app/frontend/orders-dashboard/components/OrdersDashboardTable.scss";
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
  return (
    <table className="orders-dashboard-table">
      <thead className="orders-dashboard-table__head">
        <tr>
          <th className="orders-dashboard-table__checkbox-header-cell">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={onToggleAllVisible}
              aria-label="Select all visible orders"
            />
          </th>
          <th className="orders-dashboard-table__header-cell">Order</th>
          <th className="orders-dashboard-table__header-cell">Date</th>
          <th className="orders-dashboard-table__header-cell">Customer</th>
          <th className="orders-dashboard-table__header-cell">Total</th>
          <th className="orders-dashboard-table__header-cell">
            Payment status
          </th>
          <th className="orders-dashboard-table__header-cell">
            Fulfillment status
          </th>
          <th className="orders-dashboard-table__header-cell">Items</th>
          <th className="orders-dashboard-table__header-cell">
            Delivery method
          </th>
          <th className="orders-dashboard-table__header-cell">ZIP code</th>
        </tr>
      </thead>

      <tbody>
        {orders.length === 0 ? (
          <tr>
            <td colSpan={3} className="orders-dashboard-table__empty-cell">
              No orders found.
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
                    aria-label={`Select order ${order.name}`}
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
                  {DateUtils.formatDate(order.createdAt)}
                </td>

                <td className="orders-dashboard-table__body-cell">
                  {order.customer?.displayName ?? ""}
                </td>

                <td className="orders-dashboard-table__body-cell">
                  {`${order.netPaymentSet.presentmentMoney.currencyCode} ${order.netPaymentSet.presentmentMoney.amount}`}
                </td>

                <td className="orders-dashboard-table__body-cell">
                  {(() => {
                    const { label, tone } = formatFinancialStatusWithTone(
                      order.displayFinancialStatus,
                    );
                    return <Badge tone={tone}>{label}</Badge>;
                  })()}
                </td>

                <td className="orders-dashboard-table__body-cell">
                  {(() => {
                    const { label, tone } = formatFulfillmentStatusWithTone(
                      order.displayFulfillmentStatus,
                    );
                    return <Badge tone={tone}>{label}</Badge>;
                  })()}
                </td>

                <td className="orders-dashboard-table__body-cell">
                  {`${order.currentSubtotalLineItemsQuantity} ${order.currentSubtotalLineItemsQuantity > 1 ? "items" : "item"}`}
                </td>

                <td className="orders-dashboard-table__body-cell">
                  {formatDeliveryMethodType(
                    order.fulfillmentOrders.edges[0]?.node?.deliveryMethod
                      ?.methodType,
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
                      return <Badge tone="critical">Missing</Badge>;
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
