import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { readRequiredEnv } from "../core/utils/readRequiredEnv";
import type { AllowedContentType } from "./models/AllowedContentType";

let cached: { s3: S3Client; bucket: string } | null = null;

function getS3(): { s3: S3Client; bucket: string } {
  if (!cached) {
    cached = {
      s3: new S3Client({
        region: readRequiredEnv("AWS_REGION"),
        credentials: {
          accessKeyId: readRequiredEnv("AWS_ACCESS_KEY_ID"),
          secretAccessKey: readRequiredEnv("AWS_SECRET_ACCESS_KEY"),
        },
      }),
      bucket: readRequiredEnv("AWS_BUCKET"),
    };
  }

  return cached;
}

/** Throws if a variable is missing, so a request can fail before starting a job. */
export function assertS3Configured(): void {
  getS3();
}

export async function uploadToS3(args: {
  buf: Buffer;
  key: string;
  contentType: AllowedContentType;
  /** Stored with the object (x-amz-meta-*): plain ASCII, 2 KB in all. */
  metadata?: Record<string, string>;
}): Promise<void> {
  const { s3, bucket } = getS3();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: args.key,
      Body: args.buf,
      ContentType: args.contentType,
      Metadata: args.metadata,
    }),
  );
}

/** The metadata stored with an object, without downloading it. */
export async function readS3Metadata(
  key: string,
): Promise<Record<string, string>> {
  const { s3, bucket } = getS3();
  const head = await s3.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  );
  return head.Metadata ?? {};
}

/** One object, as an S3 listing describes it. */
export type S3ObjectSummary = {
  key: string;
  lastModified: Date;
  sizeBytes: number;
};

/** S3 answers at most 1000 keys per request. */
const LIST_PAGE_SIZE = 1000;

/**
 * Every object under `prefix`, in S3's (key) order. Metadata only, a request
 * per 1000 keys; stops after `maxObjects` as a guard. Needs `s3:ListBucket`
 * on the bucket.
 */
export async function listS3Objects(
  prefix: string,
  maxObjects = 10_000,
): Promise<S3ObjectSummary[]> {
  const { s3, bucket } = getS3();
  const objects: S3ObjectSummary[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: LIST_PAGE_SIZE,
        ContinuationToken: continuationToken,
      }),
    );
    for (const object of page.Contents ?? []) {
      if (!object.Key || !object.LastModified) continue;
      objects.push({
        key: object.Key,
        lastModified: object.LastModified,
        sizeBytes: object.Size ?? 0,
      });
    }
    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken && objects.length < maxObjects);

  return objects;
}

/**
 * A link that downloads the object without an AWS sign-in, until it expires.
 *
 * Signing is local (no request to S3), so a fresh link per page load is
 * cheap. `Content-Disposition` makes the browser save the file under
 * `fileName` instead of the key's last segment.
 */
export async function getDownloadUrl(args: {
  key: string;
  fileName: string;
  expiresInSeconds: number;
}): Promise<string> {
  const { s3, bucket } = getS3();

  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: args.key,
      ResponseContentDisposition: contentDisposition(args.fileName),
    }),
    { expiresIn: args.expiresInSeconds },
  );
}

/** RFC 5987: an ASCII fallback plus the UTF-8 form. */
function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
