import type { TranslationKey } from "../i18n/translations";
import { ORDERS_DASHBOARD_PATH } from "../orders/OrdersDashboardFilter";
import { PACKS_PATH } from "../packs/FulfillmentPack";
import { AWB_REPORT_PATH } from "../shipping-labels/AwbReport";
import { DOCUMENTS_PATH } from "../documents/Documents";
import { TUTORIALS_PATH } from "../tutorials/Tutorials";
import { UNFULFILLED_REPORT_PATH } from "../unfulfilled-report/UnfulfilledReport";

export type AppNavEntry = {
  path: string;
  label: TranslationKey;
  /** One line on the home page card. */
  description: TranslationKey;
  /** The card's colour: a light background and a strong accent. */
  color: { background: string; accent: string };
};

/** The app's pages, in menu order. The menu and the home page cards use it. */
export const APP_NAV: AppNavEntry[] = [
  {
    path: PACKS_PATH,
    label: "nav.packs",
    description: "home.packs",
    color: { background: "#E6F4EA", accent: "#1E7B3A" },
  },
  {
    path: ORDERS_DASHBOARD_PATH,
    label: "nav.orders",
    description: "home.orders",
    color: { background: "#FFF4E0", accent: "#A65C00" },
  },
  {
    path: UNFULFILLED_REPORT_PATH,
    label: "nav.unfulfilledReport",
    description: "home.unfulfilledReport",
    color: { background: "#E8F0FE", accent: "#1A56C4" },
  },
  {
    path: AWB_REPORT_PATH,
    label: "nav.awbReport",
    description: "home.awbReport",
    color: { background: "#F3E8FD", accent: "#7B2CBF" },
  },
  {
    path: DOCUMENTS_PATH,
    label: "nav.documents",
    description: "home.documents",
    color: { background: "#FCEFE3", accent: "#B4540A" },
  },
  {
    path: TUTORIALS_PATH,
    label: "nav.tutorials",
    description: "home.tutorials",
    color: { background: "#E0F5F5", accent: "#0B7A75" },
  },
  {
    path: "/app/settings",
    label: "nav.settings",
    description: "home.settings",
    color: { background: "#F1F1F1", accent: "#4A4A4A" },
  },
  {
    path: "/app/developer-panel",
    label: "nav.developerPanel",
    description: "home.developerPanel",
    color: { background: "#FDECEC", accent: "#B42318" },
  },
];
