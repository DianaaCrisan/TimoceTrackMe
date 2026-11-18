import { INTL_LOCALE, type Locale } from "../i18n/Locale";
import type { TranslationKey } from "../i18n/translations";

export const DOCUMENTS_PATH = "/app/documents";

/** Documents shown per category and page. */
export const DOCUMENTS_PAGE_SIZE = 50;

/** The kinds of document the Documents page lists, in page order. */
export const DOCUMENT_CATEGORY_IDS = ["labels"] as const;

export type DocumentCategoryId = (typeof DOCUMENT_CATEGORY_IDS)[number];

export const DOCUMENT_CATEGORY_LABELS: Record<
  DocumentCategoryId,
  TranslationKey
> = {
  labels: "documents.category.labels",
};

/** The page of a category, in the URL: `?labels=2`. */
export function documentPageParam(category: DocumentCategoryId): string {
  return category;
}

/** One stored document, as the page shows it. */
export type DocumentView = {
  /** The S3 key, unique. */
  key: string;
  fileName: string;
  /** When it was stored, ISO. */
  storedAt: string;
  sizeBytes: number;
  /** Signed for an hour; null if signing failed. */
  downloadUrl: string | null;
  /**
   * The orders inside, as on the labels' first page: "#1201-1206, #1209".
   * Null for documents saved before the list was recorded.
   */
  orders: { ranges: string; count: number } | null;
};

export type DocumentCategoryView = {
  id: DocumentCategoryId;
  /** This page's documents, newest first. */
  documents: DocumentView[];
  /** Documents in the category, every page. */
  total: number;
  /** From 1. */
  page: number;
  pageCount: number;
  /** Set when S3 could not be read for this category. */
  error: { kind: "accessDenied" | "other"; message: string } | null;
};

/** "820 KB", "1,4 MB": what a download weighs. */
export function formatFileSize(bytes: number, locale: Locale): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  return `${new Intl.NumberFormat(INTL_LOCALE[locale], {
    maximumFractionDigits: digits,
  }).format(value)} ${units[unit]}`;
}
