export class LineItem {
  variantId: string;
  quantity: number;
  name: string;
  sku?: string | null;

  constructor(
    variantId: string,
    quantity: number,
    name: string,
    sku?: string | null,
  ) {
    this.variantId = variantId;
    this.quantity = quantity;
    this.name = name;
    this.sku = sku;
  }

  getKey(): string {
    return this.variantId;
  }

  private buildLineItemDisplayName(item: LineItem): string {
    return `${item.name} (${item.quantity})`;
  }

  static buildLineItemsDisplayName(items: LineItem[]): string {
    return items.map((item) => item.buildLineItemDisplayName(item)).join(", ");
  }

  clone(): LineItem {
    return new LineItem(this.variantId, this.quantity, this.name, this.sku);
  }
}
