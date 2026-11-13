export type S3SetupStatus = {
  envVars: { name: string; isSet: boolean }[];
  /** Not secret, so shown in full to make a wrong value easy to spot. */
  bucket: string | null;
  region: string | null;
  /** Where this app's jobs are stored: "<APP_NAME>/". */
  appFolderKey: string;
  appFolderConsoleUrl: string | null;
};
