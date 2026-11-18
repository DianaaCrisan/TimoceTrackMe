import {
  DOCUMENT_CATEGORY_IDS,
  DOCUMENTS_PAGE_SIZE,
  type DocumentCategoryId,
  type DocumentCategoryView,
} from "app/commons/documents/Documents";
import { buildAppFolderKey, type JobKind } from "../aws-s3/buildJobFileKey";
import {
  getDownloadUrl,
  listS3Objects,
  readS3Metadata,
  type S3ObjectSummary,
} from "../aws-s3/uploadToS3.server";
import { decodeOrderListMetadata } from "./orderListMetadata";

/** Long enough to click; the page signs fresh links on every load. */
const DOWNLOAD_LINK_EXPIRES_IN_SECONDS = 60 * 60;

/**
 * Where each category lives in S3 and which of its files are documents.
 * A failed job leaves a text file next to the documents; it is not one.
 */
const CATEGORY_SOURCES: Record<
  DocumentCategoryId,
  { job: JobKind; isDocument: (fileName: string) => boolean }
> = {
  labels: {
    job: "print-labels",
    isDocument: (fileName) => fileName.toLowerCase().endsWith(".zip"),
  },
};

type Deps = {
  list: (prefix: string) => Promise<S3ObjectSummary[]>;
  sign: (key: string, fileName: string) => Promise<string>;
  /** A HEAD request: the metadata only, never the file. */
  readMetadata: (key: string) => Promise<Record<string, string>>;
  appFolderKey: string;
};

const defaultDeps = (): Deps => ({
  list: (prefix) => listS3Objects(prefix),
  sign: (key, fileName) =>
    getDownloadUrl({
      key,
      fileName,
      expiresInSeconds: DOWNLOAD_LINK_EXPIRES_IN_SECONDS,
    }),
  readMetadata: readS3Metadata,
  appFolderKey: buildAppFolderKey(),
});

/**
 * The documents of every category, read from S3 on each call: S3 is the
 * only record. A document S3 has deleted (its lifecycle rule) is simply not
 * listed. Newest first; only the requested page is signed for download,
 * and only its documents are asked for their order list.
 */
export async function listDocuments(
  pages: Partial<Record<DocumentCategoryId, number>>,
  deps: Deps = defaultDeps(),
): Promise<DocumentCategoryView[]> {
  return Promise.all(
    DOCUMENT_CATEGORY_IDS.map((id) => listCategory(id, pages[id] ?? 1, deps)),
  );
}

async function listCategory(
  id: DocumentCategoryId,
  requestedPage: number,
  deps: Deps,
): Promise<DocumentCategoryView> {
  const source = CATEGORY_SOURCES[id];

  let objects: S3ObjectSummary[];
  try {
    objects = await deps.list(`${deps.appFolderKey}${source.job}/`);
  } catch (error) {
    console.error(`AppError[Documents] could not list "${id}".`, error);
    return {
      id,
      documents: [],
      total: 0,
      page: 1,
      pageCount: 1,
      error: {
        // the AWS user may upload and sign links without being allowed to list
        kind: isAccessDenied(error) ? "accessDenied" : "other",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }

  const documents = objects
    .map((object) => ({ ...object, fileName: readStoredFileName(object.key) }))
    .filter((object) => source.isDocument(object.fileName))
    .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

  const pageCount = Math.max(
    1,
    Math.ceil(documents.length / DOCUMENTS_PAGE_SIZE),
  );
  const page = Math.min(Math.max(1, Math.floor(requestedPage) || 1), pageCount);
  const shown = documents.slice(
    (page - 1) * DOCUMENTS_PAGE_SIZE,
    page * DOCUMENTS_PAGE_SIZE,
  );

  return {
    id,
    documents: await Promise.all(
      shown.map(async (object) => ({
        key: object.key,
        fileName: object.fileName,
        storedAt: object.lastModified.toISOString(),
        sizeBytes: object.sizeBytes,
        downloadUrl: await deps
          .sign(object.key, object.fileName)
          .catch((error) => {
            console.error(
              `AppError[Documents] could not sign ${object.key}.`,
              error,
            );
            return null;
          }),
        orders: await deps
          .readMetadata(object.key)
          .then(decodeOrderListMetadata)
          .catch((error) => {
            console.error(
              `AppError[Documents] could not read the orders of ${object.key}.`,
              error,
            );
            return null;
          }),
      })),
    ),
    total: documents.length,
    page,
    pageCount,
    error: null,
  };
}

function isAccessDenied(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    ((error as { name?: string }).name === "AccessDenied" ||
      (error as { Code?: string }).Code === "AccessDenied")
  );
}

/**
 * The file's own name from its key, without the time and run id the job
 * put in front: `…/2026-11-18/16-07-02_a1b2c3d4_labels_18.11.zip` →
 * `labels_18.11.zip`. See `buildJobFileKey`.
 */
export function readStoredFileName(key: string): string {
  const name = key.split("/").pop() ?? key;
  return name.replace(/^\d{2}-\d{2}-\d{2}_[A-Za-z0-9]{1,8}_/, "") || name;
}
