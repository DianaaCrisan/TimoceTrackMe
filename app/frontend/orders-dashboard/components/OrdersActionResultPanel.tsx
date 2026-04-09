import "app/frontend/orders-dashboard/components/OrdersActionResultPanel.scss";

type FailedOrder = {
  id: string;
  name: string;
  errors: string[];
};

type OrdersActionResultPanelProps = {
  title: string;
  successMessage?: string;
  failedOrders?: FailedOrder[];
  genericErrors?: string[];
};

export function OrdersActionResultPanel({
  title,
  successMessage,
  failedOrders = [],
  genericErrors = [],
}: OrdersActionResultPanelProps) {
  const hasFailures = failedOrders.length > 0 || genericErrors.length > 0;

  return (
    <div className="orders-action-result-panel">
      <div className="orders-action-result-panel__header">
        <h3 className="orders-action-result-panel__title">{title}</h3>
      </div>

      <div className="orders-action-result-panel__body">
        {successMessage ? (
          <div className="orders-action-result-panel__success">
            {successMessage}
          </div>
        ) : null}

        {genericErrors.length > 0 ? (
          <div className="orders-action-result-panel__section">
            <div className="orders-action-result-panel__section-title">
              Errors
            </div>

            <div className="orders-action-result-panel__error-list">
              {genericErrors.map((error, index) => (
                <div
                  key={`${error}-${index}`}
                  className="orders-action-result-panel__error-item"
                >
                  {error}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {failedOrders.length > 0 ? (
          <div className="orders-action-result-panel__section">
            <div className="orders-action-result-panel__section-title">
              Orders with errors
            </div>

            <div className="orders-action-result-panel__failed-orders">
              {failedOrders.map((order) => (
                <div
                  key={`${order.id}-${order.name}`}
                  className="orders-action-result-panel__failed-order"
                >
                  <div className="orders-action-result-panel__failed-order-name">
                    {order.name || order.id || "-"}
                  </div>

                  <ul className="orders-action-result-panel__failed-order-errors">
                    {order.errors.map((error, index) => (
                      <li key={`${order.id}-${index}`}>{error}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!successMessage && !hasFailures ? (
          <div className="orders-action-result-panel__empty">
            No result to display.
          </div>
        ) : null}
      </div>
    </div>
  );
}
