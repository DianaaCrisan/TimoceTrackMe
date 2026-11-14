/**
 * The most orders one bulk job takes, whether picked by hand or with
 * "Select all in this filter". Keeps a single run's Optimus calls, label PDFs
 * and memory in a range that has been thought about.
 */
export const MAX_ORDERS_PER_JOB = 1000;

/**
 * Added to an order once its label is in a printed PDF. The Unprinted tab
 * filters on it, so it must not change without retagging existing orders.
 */
export const PRINTED_ORDER_TAG = "eticheta-printata";
