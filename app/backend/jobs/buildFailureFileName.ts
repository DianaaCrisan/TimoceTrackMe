import type { Translate } from "app/commons/i18n/translate";
import type { JobKind } from "../aws-s3/buildJobFileKey";

/**
 * The text file a failed job leaves in S3, in the language of whoever started
 * it: "FAILED_print-labels.txt" / "ESUAT_printare-etichete.txt".
 */
export function buildFailureFileName(job: JobKind, t: Translate): string {
  return `${t("fileName.failed", { job: t(`fileName.job.${job}`) })}.txt`;
}
