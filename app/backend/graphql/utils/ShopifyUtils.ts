export class ShopifyUtils {
  /**
   * TODO: find better approach
   * Receives the shop domain, for instance 'tropicaltesting.myshopify.com'
   * Returns the admin URL 'https://admin.shopify.com/store/tropicaltesting'
   */
  static getShopAdminUrl(shopDomain: string): string {
    const storeName = shopDomain.replace(".myshopify.com", "");
    return `https://admin.shopify.com/store/${storeName}`;
  }

  /**
   * @example
   * input: gid://shopify/Order/6770410881351
   * output: 6770410881351
   */
  static extractShopifyId(gid: string): string | null {
    const match = gid.match(/gid:\/\/shopify\/\w+\/(\d+)/);
    return match ? match[1] : null;
  }
}
