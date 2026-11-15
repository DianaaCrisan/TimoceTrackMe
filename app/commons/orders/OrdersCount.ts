export type OrdersCount = {
  count: number;
  /** Shopify stops counting at 10,000 and then reports a lower bound. */
  isAtLeast: boolean;
};
