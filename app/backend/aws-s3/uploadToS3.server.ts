import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
}): Promise<void> {
  const { s3, bucket } = getS3();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: args.key,
      Body: args.buf,
      ContentType: args.contentType,
    }),
  );
}
