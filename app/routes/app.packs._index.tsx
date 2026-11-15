import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  PackRepository,
  toPackView,
} from "app/backend/packs/PackRepository.server";
import { PackService } from "app/backend/packs/PackService.server";
import { buildScopeTabUrl, ALL_ORDERS_SCOPE } from "app/commons/orders/OrdersScope";
import { isFillingPack } from "app/commons/packs/FulfillmentPack";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";
import { PackSummary } from "app/frontend/packs/components/PackSummary";
import { usePackAction } from "app/frontend/packs/hooks/usePackAction";

/**
 * The working list: the filling pack and the packs being worked on, each
 * with its progress, then the latest closed packs.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const { workingPacks, closedPacks } = await PackRepository.list();
  const progress = await Promise.all(
    workingPacks.map((pack) => PackService.getProgress(admin, pack)),
  );

  return {
    workingPacks: workingPacks.map((pack, index) => ({
      pack: toPackView(pack),
      progress: progress[index],
    })),
    closedPacks: closedPacks.map(toPackView),
  };
};

export default function PacksRoute() {
  const { workingPacks, closedPacks } = useLoaderData<typeof loader>();
  const { t } = useI18n();
  const { submit, isBusy } = usePackAction();
  const hasFillingPack = workingPacks.some(({ pack }) => isFillingPack(pack));

  return (
    // full width: the order lists inside the packs have many columns
    <s-page heading={t("packs.heading")} inlineSize="large">
      <TitleBar title={t("nav.packs")} />

      <s-section heading={t("packs.workingHeading")}>
        <s-stack direction="block" gap="base">
          <s-paragraph>
            {t("packs.intro")}{" "}
            <Link to={buildScopeTabUrl(ALL_ORDERS_SCOPE, "not_in_pack")}>
              {t("packs.notInPackLink")}
            </Link>
          </s-paragraph>

          {!hasFillingPack ? (
            <div>
              <s-button
                variant="primary"
                {...(isBusy ? { loading: true } : {})}
                onClick={() => submit("create")}
              >
                {t("packs.newPack")}
              </s-button>
            </div>
          ) : null}

          {workingPacks.length === 0 ? (
            <s-paragraph>{t("packs.noWorkingPacks")}</s-paragraph>
          ) : (
            workingPacks.map(({ pack, progress }) => (
              <PackSummary
                key={pack.id}
                pack={pack}
                progress={progress}
                linksToPack
              />
            ))
          )}
        </s-stack>
      </s-section>

      {closedPacks.length > 0 ? (
        <s-section heading={t("packs.closedHeading")}>
          <s-stack direction="block" gap="small">
            {closedPacks.map((pack) => (
              <PackSummary
                key={pack.id}
                pack={pack}
                progress={null}
                linksToPack
              />
            ))}
          </s-stack>
        </s-section>
      ) : null}
    </s-page>
  );
}
