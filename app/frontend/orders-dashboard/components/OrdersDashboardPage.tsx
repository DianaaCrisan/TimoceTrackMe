import { useMemo, useState } from "react";
import type { FetcherWithComponents } from "react-router";
import { CursorPagination } from "app/frontend/core/components/CursorPagination";
import { OrdersDashboardTable } from "app/frontend/orders-dashboard/components/OrdersDashboardTable";
import "app/frontend/orders-dashboard/components/OrdersDashboardPage.scss";
import { PageInfo } from "app/types/admin.types";
import { AddTrackingNumbersResult } from "app/backend/add-tracking/addTrackingNumbers.types";
import { useAppBridge } from "@shopify/app-bridge-react";
import { OrdersActionResultPanel } from "./OrdersActionResultPanel";
import { MAX_SELECTED_ORDERS } from "app/commons/constants";

type PrintLabelsUiResult = {
  ok: boolean;
  hasDownloadableFile: boolean;
  errors: string[];
};

type OrdersDashboardPageProps = {
  orders: {
    id: string;
    name: string;
    createdAt: string;
  }[];
  pageInfo: PageInfo;
  addTrackingFetcher: FetcherWithComponents<{
    ok: boolean;
    data: AddTrackingNumbersResult;
  }>;
};

type SolveZipCodesResult = {
  ok: boolean;
  successfulOrders: {
    id: string;
    name: string;
  }[];
  failedOrders: {
    id: string;
    name: string;
    errors: string[];
  }[];
};

export function OrdersDashboardPage({
  orders,
  pageInfo,
  addTrackingFetcher,
}: OrdersDashboardPageProps) {
  const shopify = useAppBridge();

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const selectedCount = selectedOrderIds.length;

  const [printLabelsResult, setPrintLabelsResult] =
    useState<PrintLabelsUiResult | null>(null);
  const [isDownloadingLabels, setIsDownloadingLabels] = useState(false);

  const [solveZipCodesResult, setSolveZipCodesResult] =
    useState<SolveZipCodesResult | null>(null);
  const [isSolvingZipCodes, setIsSolvingZipCodes] = useState(false);

  const isAddTrackingSubmitting =
    ["loading", "submitting"].includes(addTrackingFetcher.state) &&
    addTrackingFetcher.formMethod === "POST";

  const isAnyBulkActionRunning =
    isAddTrackingSubmitting || isDownloadingLabels || isSolvingZipCodes;

  const allVisibleSelected =
    orders.length > 0 &&
    orders.every((order) => selectedOrderIds.includes(order.id));

  const canSelectMore = selectedCount < MAX_SELECTED_ORDERS;

  const handleToggleOrder = (orderId: string) => {
    setSelectedOrderIds((currentSelectedIds) => {
      const isAlreadySelected = currentSelectedIds.includes(orderId);

      if (isAlreadySelected) {
        return currentSelectedIds.filter((id) => id !== orderId);
      }

      if (currentSelectedIds.length >= MAX_SELECTED_ORDERS) {
        return currentSelectedIds;
      }

      return [...currentSelectedIds, orderId];
    });
  };

  const handleToggleAllVisible = () => {
    setSelectedOrderIds((currentSelectedIds) => {
      const visibleOrderIds = orders.map((order) => order.id);

      if (allVisibleSelected) {
        return currentSelectedIds.filter((id) => !visibleOrderIds.includes(id));
      }

      const unselectedVisibleIds = visibleOrderIds.filter(
        (id) => !currentSelectedIds.includes(id),
      );

      const remainingSlots = MAX_SELECTED_ORDERS - currentSelectedIds.length;

      if (remainingSlots <= 0) {
        return currentSelectedIds;
      }

      return [
        ...currentSelectedIds,
        ...unselectedVisibleIds.slice(0, remainingSlots),
      ];
    });
  };

  const selectionSummary = useMemo(() => {
    if (selectedCount === 0) return null;
    return `${selectedCount} selected`;
  }, [selectedCount]);

  async function handleDownloadLabels() {
    setIsDownloadingLabels(true);
    try {
      const token = await shopify.idToken();

      const formData = new FormData();
      selectedOrderIds.forEach((orderId) => {
        formData.append("selectedOrderIds", orderId);
      });

      const response = await fetch(
        "/app/orders-dashboard/print-labels-download",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      const contentType = response.headers.get("Content-Type") ?? "";

      if (!response.ok) {
        if (contentType.includes("application/json")) {
          const errorData = await response.json();

          setPrintLabelsResult({
            ok: false,
            hasDownloadableFile: false,
            errors: errorData.errors ?? [],
          });

          return;
        }

        const errorText = await response.text();

        setPrintLabelsResult({
          ok: false,
          hasDownloadableFile: false,
          errors: [errorText || "Failed to download labels."],
        });

        return;
      }

      const blob = await response.blob();

      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileNameMatch = disposition.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch?.[1] ?? "labels-download";

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setPrintLabelsResult({
        ok: true,
        hasDownloadableFile: true,
        errors: [],
      });
    } catch (error) {
      setPrintLabelsResult({
        ok: false,
        hasDownloadableFile: false,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    } finally {
      setIsDownloadingLabels(false);
    }
  }

  async function handleSolveZipCodes() {
    setIsSolvingZipCodes(true);

    try {
      const token = await shopify.idToken();

      const formData = new FormData();
      selectedOrderIds.forEach((orderId) => {
        formData.append("selectedOrderIds", orderId);
      });

      const response = await fetch("/app/orders-dashboard/solve-zip-codes", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const contentType = response.headers.get("Content-Type") ?? "";

      if (!response.ok) {
        if (contentType.includes("application/json")) {
          const errorData = await response.json();

          setSolveZipCodesResult({
            ok: false,
            successfulOrders: [],
            failedOrders: errorData.failedOrders ?? [
              {
                id: "",
                name: "-",
                errors: errorData.errors ?? ["Failed to solve ZIP codes."],
              },
            ],
          });

          return;
        }

        const errorText = await response.text();

        setSolveZipCodesResult({
          ok: false,
          successfulOrders: [],
          failedOrders: [
            {
              id: "",
              name: "-",
              errors: [errorText || "Failed to solve ZIP codes."],
            },
          ],
        });

        return;
      }

      const result: SolveZipCodesResult = await response.json();
      setSolveZipCodesResult(result);
    } catch (error) {
      setSolveZipCodesResult({
        ok: false,
        successfulOrders: [],
        failedOrders: [
          {
            id: "",
            name: "-",
            errors: [error instanceof Error ? error.message : String(error)],
          },
        ],
      });
    } finally {
      setIsSolvingZipCodes(false);
    }
  }

  return (
    <div className="orders-dashboard-page">
      <div className="orders-dashboard-page__surface">
        <div className="orders-dashboard-page__tabs">
          <button
            type="button"
            className="orders-dashboard-page__tab orders-dashboard-page__tab--active"
          >
            All
          </button>

          <button type="button" className="orders-dashboard-page__tab">
            Pending fulfillment
          </button>
        </div>

        {selectedCount > 0 ? (
          <div className="orders-dashboard-page__bulk-bar">
            <div className="orders-dashboard-page__bulk-bar-text">
              {selectionSummary}
            </div>

            <div className="orders-dashboard-page__bulk-actions">
              <button
                type="button"
                className="orders-dashboard-page__bulk-action-button"
                disabled={isAnyBulkActionRunning}
                onClick={handleSolveZipCodes}
              >
                <span
                  className="orders-dashboard-page__bulk-action-icon"
                  aria-hidden="true"
                >
                  📮
                </span>
                {isSolvingZipCodes ? "Solving ZIP codes..." : "Solve ZIP codes"}
              </button>

              <addTrackingFetcher.Form method="post">
                <input type="hidden" name="intent" value="add-tracking" />

                {selectedOrderIds.map((orderId) => (
                  <input
                    key={orderId}
                    type="hidden"
                    name="selectedOrderIds"
                    value={orderId}
                  />
                ))}

                <button
                  type="submit"
                  className="orders-dashboard-page__bulk-action-button"
                  disabled={isAddTrackingSubmitting}
                >
                  <span
                    className="orders-dashboard-page__bulk-action-icon"
                    aria-hidden="true"
                  >
                    🚚
                  </span>
                  {isAddTrackingSubmitting
                    ? "Adding tracking numbers..."
                    : "Add tracking numbers"}
                </button>
              </addTrackingFetcher.Form>

              <button
                type="button"
                className="orders-dashboard-page__bulk-action-button"
                disabled={isAnyBulkActionRunning}
                onClick={handleDownloadLabels}
              >
                <span
                  className="orders-dashboard-page__bulk-action-icon"
                  aria-hidden="true"
                >
                  🖨️
                </span>
                {isDownloadingLabels
                  ? "Downloading labels..."
                  : "Download labels"}
              </button>
            </div>
          </div>
        ) : null}

        <OrdersDashboardTable
          orders={orders}
          selectedOrderIds={selectedOrderIds}
          canSelectMore={canSelectMore}
          allVisibleSelected={allVisibleSelected}
          onToggleOrder={handleToggleOrder}
          onToggleAllVisible={handleToggleAllVisible}
        />
      </div>

      <div className="orders-dashboard-page__pagination">
        <CursorPagination
          basePath="/app/orders-dashboard"
          pageInfo={pageInfo}
        />
      </div>

      {addTrackingFetcher.data ? (
        <OrdersActionResultPanel
          title="Add tracking numbers result"
          successMessage={
            addTrackingFetcher.data.data.successfulOrders.length > 0
              ? `Tracking numbers added for ${addTrackingFetcher.data.data.successfulOrders.length} order(s).`
              : undefined
          }
          failedOrders={addTrackingFetcher.data.data.failedOrders}
        />
      ) : null}

      {printLabelsResult ? (
        <OrdersActionResultPanel
          title="Print labels result"
          successMessage={
            printLabelsResult.ok && printLabelsResult.hasDownloadableFile
              ? "Labels downloaded successfully."
              : undefined
          }
          genericErrors={printLabelsResult.errors}
        />
      ) : null}

      {solveZipCodesResult ? (
        <OrdersActionResultPanel
          title="Solve ZIP codes result"
          successMessage={
            solveZipCodesResult.successfulOrders.length > 0
              ? `ZIP codes solved for ${solveZipCodesResult.successfulOrders.length} order(s).`
              : undefined
          }
          failedOrders={solveZipCodesResult.failedOrders}
        />
      ) : null}
    </div>
  );
}
