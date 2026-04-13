export type AddressInput = {
  /** A unique identifier you can use to map the result back to your original data. */
  orderId: string | null;
  addressLine?: string | null;
  city?: string | null;
  county?: string | null;
};
