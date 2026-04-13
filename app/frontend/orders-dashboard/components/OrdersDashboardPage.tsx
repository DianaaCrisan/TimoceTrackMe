import { useEffect, useMemo, useRef, useState } from "react";
import { CursorPagination } from "app/frontend/core/components/CursorPagination";
import { OrdersDashboardTable } from "app/frontend/orders-dashboard/components/OrdersDashboardTable";
import "app/frontend/orders-dashboard/components/OrdersDashboardPage.scss";
import { PageInfo } from "app/types/admin.types";
import { useAppBridge } from "@shopify/app-bridge-react";
import { OrdersActionResultPanel } from "./OrdersActionResultPanel";
import { MAX_SELECTED_ORDERS } from "app/commons/constants";
import deliveryIcon from "app/frontend/core/icons/DeliveryIcon.svg";
import locationIcon from "app/frontend/core/icons/LocationIcon.svg";
import printIcon from "app/frontend/core/icons/PrintIcon.svg";
import { OrdersDashboardFilter } from "app/backend/orders/orders-dashboard.server";
import { Link, useLocation } from "react-router";
import { OrdersDashboardQuery } from "app/types/admin.generated";

type PrintLabelsResult = {
  ok: boolean;
  hasDownloadableFile: boolean;
  errors: string[];
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

type AddTrackingResult = {
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

type OrdersDashboardPageProps = {
  orders: OrdersDashboardQuery["orders"]["edges"][number]["node"][];
  pageInfo: PageInfo;
  shopAdminUrl: string;
  activeFilter: OrdersDashboardFilter;
};

export function OrdersDashboardPage({
  orders,
  pageInfo,
  shopAdminUrl,
  activeFilter,
}: OrdersDashboardPageProps) {
  const shopify = useAppBridge();

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const selectedCount = selectedOrderIds.length;

  const [printLabelsResult, setPrintLabelsResult] =
    useState<PrintLabelsResult | null>(null);
  const [isDownloadingLabels, setIsDownloadingLabels] = useState(false);

  const [solveZipCodesResult, setSolveZipCodesResult] =
    useState<SolveZipCodesResult | null>(null);
  const [isSolvingZipCodes, setIsSolvingZipCodes] = useState(false);

  const [addTrackingResult, setAddTrackingResult] =
    useState<AddTrackingResult | null>(null);
  const [isAddingTracking, setIsAddingTracking] = useState(false);

  const isAnyBulkActionRunning =
    isAddingTracking || isDownloadingLabels || isSolvingZipCodes;

  const hasVisibleResponse =
    printLabelsResult !== null ||
    solveZipCodesResult !== null ||
    addTrackingResult !== null;

  const allVisibleSelected =
    orders.length > 0 &&
    orders.every((order) => selectedOrderIds.includes(order.id));

  const canSelectMore = selectedCount < MAX_SELECTED_ORDERS;

  const selectionSummary = useMemo(() => {
    if (selectedCount === 0) return null;
    return `${selectedCount} selected`;
  }, [selectedCount]);

  // reset scroll position when going to the next page
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  useEffect(() => {
    tableScrollRef.current?.scrollTo({ top: 0 });
  }, [location.search]);

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

  async function handleAddTracking() {
    setIsAddingTracking(true);

    try {
      const token = await shopify.idToken();

      const formData = new FormData();
      selectedOrderIds.forEach((orderId) => {
        formData.append("selectedOrderIds", orderId);
      });

      const response = await fetch("/app/orders-dashboard/add-tracking", {
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

          setAddTrackingResult({
            ok: false,
            successfulOrders: [],
            failedOrders: errorData.failedOrders ?? [
              {
                id: "",
                name: "-",
                errors: errorData.errors ?? ["Failed to add tracking numbers."],
              },
            ],
          });

          return;
        }

        const errorText = await response.text();

        setAddTrackingResult({
          ok: false,
          successfulOrders: [],
          failedOrders: [
            {
              id: "",
              name: "-",
              errors: [errorText || "Failed to add tracking numbers."],
            },
          ],
        });

        return;
      }

      const result: AddTrackingResult = await response.json();
      setAddTrackingResult(result);
    } catch (error) {
      setAddTrackingResult({
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
      setIsAddingTracking(false);
    }
  }

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
        <div className="orders-dashboard-page__toolbar">
          <div className="orders-dashboard-page__tabs">
            <Link
              to="/app/orders-dashboard"
              className={`orders-dashboard-page__tab${
                activeFilter === "all" ? " --active" : ""
              }`}
            >
              All
            </Link>

            <Link
              to="/app/orders-dashboard?filter=pending_fulfillment"
              className={`orders-dashboard-page__tab${
                activeFilter === "pending_fulfillment" ? " --active" : ""
              }`}
            >
              Pending fulfillment
            </Link>
          </div>

          <div className="orders-dashboard-page__toolbar-right">
            {selectedCount > 0 ? (
              <>
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
                      <img src={locationIcon} alt="" width={20} height={20} />
                    </span>
                    {isSolvingZipCodes
                      ? "Solving ZIP codes..."
                      : "Solve ZIP codes"}
                  </button>

                  <button
                    type="button"
                    className="orders-dashboard-page__bulk-action-button"
                    disabled={isAnyBulkActionRunning}
                    onClick={handleAddTracking}
                  >
                    <span
                      className="orders-dashboard-page__bulk-action-icon"
                      aria-hidden="true"
                    >
                      <img src={deliveryIcon} alt="" width={20} height={20} />
                    </span>
                    {isAddingTracking
                      ? "Adding tracking numbers..."
                      : "Add tracking numbers"}
                  </button>

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
                      <img src={printIcon} alt="" width={20} height={20} />
                    </span>
                    {isDownloadingLabels
                      ? "Downloading labels..."
                      : "Download labels"}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div
          ref={tableScrollRef}
          className={`orders-dashboard-page__table-scroll${
            hasVisibleResponse ? " --with-response" : ""
          }`}
        >
          <OrdersDashboardTable
            orders={orders}
            shopAdminUrl={shopAdminUrl}
            selectedOrderIds={selectedOrderIds}
            canSelectMore={canSelectMore}
            allVisibleSelected={allVisibleSelected}
            onToggleOrder={handleToggleOrder}
            onToggleAllVisible={handleToggleAllVisible}
          />
        </div>
      </div>

      <div className="orders-dashboard-page__pagination">
        <CursorPagination
          basePath="/app/orders-dashboard"
          pageInfo={pageInfo}
          queryParams={
            activeFilter === "pending_fulfillment"
              ? { filter: "pending_fulfillment" }
              : {}
          }
        />
      </div>

      {addTrackingResult ? (
        <OrdersActionResultPanel
          title="Add tracking numbers result"
          successMessage={
            addTrackingResult.successfulOrders.length > 0
              ? `Tracking numbers added for ${addTrackingResult.successfulOrders.length} order(s).`
              : undefined
          }
          failedOrders={addTrackingResult.failedOrders}
          onClose={() => setAddTrackingResult(null)}
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
          onClose={() => setPrintLabelsResult(null)}
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
          onClose={() => setSolveZipCodesResult(null)}
        />
      ) : null}
    </div>
  );
}
