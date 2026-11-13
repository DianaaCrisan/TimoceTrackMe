/**
 * Links into the AWS S3 console, where job results are downloaded. They need
 * an AWS sign-in; they are not public download links.
 */
export function s3ConsoleObjectUrl(args: {
  bucket: string;
  region: string;
  key: string;
}): string {
  const query = new URLSearchParams({ region: args.region, prefix: args.key });
  return `https://s3.console.aws.amazon.com/s3/object/${encodeURIComponent(args.bucket)}?${query}`;
}

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
