/** Opens a folder in the AWS S3 console. Needs an AWS sign-in. */
export function s3ConsoleFolderUrl(args: {
  bucket: string;
  region: string;
  folderKey: string;
}): string {
  const query = new URLSearchParams({
    region: args.region,
    prefix: args.folderKey,
    showversions: "false",
  });
  return `https://s3.console.aws.amazon.com/s3/buckets/${encodeURIComponent(args.bucket)}?${query}`;
}
