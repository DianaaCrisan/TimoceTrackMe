import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { buildPrintLabelsArtifact } from "app/backend/print-labels/printLabels.server";
import { MAX_SELECTED_ORDERS } from "app/commons/constants";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const formData = await request.formData();
  const selectedOrderIds = formData
    .getAll("selectedOrderIds")
    .map(String)
    .filter(Boolean);

  if (selectedOrderIds.length === 0) {
    return Response.json(
      {
        ok: false,
        errors: ["No orders were selected."],
      },
      { status: 400 },
    );
  }

  if (selectedOrderIds.length > MAX_SELECTED_ORDERS) {
    return Response.json(
      {
        ok: false,
        errors: [
          `You can select at most ${MAX_SELECTED_ORDERS} orders at once.`,
        ],
      },
      { status: 400 },
    );
  }

  const result = await buildPrintLabelsArtifact(admin, session.shop, {
    orderIds: selectedOrderIds,
  });

  const fileBuffer =
    result.zipBuffer ?? result.deliveryPdf ?? result.pickupPdf ?? null;

  if (!fileBuffer || !result.contentType || !result.fileName) {
    return Response.json(
      {
        ok: false,
        errors: result.errors.length
          ? result.errors
          : ["No labels were generated."],
      },
      { status: 400 },
    );
  }

  return new Response(fileBuffer as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Content-Length": String(fileBuffer.length),
      "Cache-Control": "no-store",
    },
  });
};
