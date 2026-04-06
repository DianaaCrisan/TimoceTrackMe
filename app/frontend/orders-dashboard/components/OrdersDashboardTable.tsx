import { DateUtils } from "app/frontend/core/utils/DateUtils";
import "app/frontend/orders-dashboard/components/OrdersDashboardTable.scss";

type OrdersDashboardTableRow = {
  id: string;
  name: string;
  createdAt: string;
};

type OrdersDashboardTableProps = {
  orders: OrdersDashboardTableRow[];
};

export function OrdersDashboardTable({ orders }: OrdersDashboardTableProps) {
  return (
    <table className="orders-dashboard-table">
      <thead className="orders-dashboard-table__head">
        <tr>
          <th className="orders-dashboard-table__header-cell">Order</th>
          <th className="orders-dashboard-table__header-cell">Created at</th>
        </tr>
      </thead>

      <tbody>
        {orders.length === 0 ? (
          <tr>
            <td colSpan={2} className="orders-dashboard-table__empty-cell">
              No orders found.
            </td>
          </tr>
        ) : (
          orders.map((order) => (
            <tr key={order.id} className="orders-dashboard-table__row">
              <td className="orders-dashboard-table__body-cell">
                {order.name}
              </td>
              <td className="orders-dashboard-table__body-cell">
                {DateUtils.formatDate(order.createdAt)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
