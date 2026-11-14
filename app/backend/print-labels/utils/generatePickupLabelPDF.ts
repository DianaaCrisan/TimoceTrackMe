import { INTL_LOCALE, type Locale } from "app/commons/i18n/Locale";
import { createTranslator } from "app/commons/i18n/translate";
import { renderTwoColumnLabel } from "./renderTwoColumnLabel";

type PickupLabelInput = {
  orderName: string;
  createdAt: string;
  confirmationNumber?: string | null;
  customer: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  /** The language of whoever printed the labels. */
  locale: Locale;
};

export async function generatePickupLabelPDF({
  orderName,
  createdAt,
  confirmationNumber,
  customer,
  locale,
}: PickupLabelInput): Promise<Uint8Array> {
  const t = createTranslator(locale);
  const fullName = `${customer.firstName ?? ""} ${customer.lastName ?? ""}`;
  const formattedDate = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(createdAt));

  const leftCol = [
    { prefix: null, name: t("pickupLabel.order", { value: orderName }) },
    {
      prefix: null,
      name: t("pickupLabel.confirmationNumber", {
        value: confirmationNumber ?? "-",
      }),
    },
    { prefix: null, name: t("pickupLabel.name", { value: fullName }) },
  ];

  const rightCol = [
    t("pickupLabel.orderDate", { value: formattedDate }),
    t("pickupLabel.email", { value: customer.email ?? "-" }),
    t("pickupLabel.phone", { value: customer.phone ?? "-" }),
  ];

  return renderTwoColumnLabel({
    title: t("pickupLabel.title"),
    leftLines: leftCol,
    rightLines: rightCol,
  });
}
