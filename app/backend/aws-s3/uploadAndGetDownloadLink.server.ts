import {
  GetObjectCommand,
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

/**
 * Uploads the file and returns a presigned GET link to it.
 *
 * The link sets `Content-Disposition`, so the browser saves the file under
 * `fileName` instead of the key's last segment, which starts with a uuid.
 */
export async function uploadAndGetDownloadLink(args: {
  buf: Buffer;
  key: string;
  fileName: string;
  contentType: AllowedContentType;
  expiresInSeconds: number;
}): Promise<string> {
  const { s3, bucket } = getS3();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: args.key,
      Body: args.buf,
      ContentType: args.contentType,
    }),
  );

  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: args.key,
      ResponseContentType: args.contentType,
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
