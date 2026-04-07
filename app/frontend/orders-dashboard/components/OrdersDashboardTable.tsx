import { DateUtils } from "app/frontend/core/utils/DateUtils";
import "app/frontend/orders-dashboard/components/OrdersDashboardTable.scss";

export type OrdersDashboardTableRow = {
  id: string;
  name: string;
  createdAt: string;
};

type OrdersDashboardTableProps = {
  orders: OrdersDashboardTableRow[];
  selectedOrderIds: string[];
  canSelectMore: boolean;
  allVisibleSelected: boolean;
  onToggleOrder: (orderId: string) => void;
  onToggleAllVisible: () => void;
};

export function OrdersDashboardTable({
  orders,
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
          <th className="orders-dashboard-table__header-cell">Created at</th>
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
                className={`orders-dashboard-table__row${
                  isSelected ? "orders-dashboard-table__row--selected" : ""
                }`}
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
                  {order.name}
                </td>

                <td className="orders-dashboard-table__body-cell">
                  {DateUtils.formatDate(order.createdAt)}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
