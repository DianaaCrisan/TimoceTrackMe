/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types.d.ts';

export type GetOrdersTrackingInputDataQueryVariables = AdminTypes.Exact<{
  ids: Array<AdminTypes.Scalars['ID']['input']> | AdminTypes.Scalars['ID']['input'];
}>;


export type GetOrdersTrackingInputDataQuery = { nodes: Array<AdminTypes.Maybe<(
    Pick<AdminTypes.Order, 'id' | 'name' | 'email' | 'phone' | 'createdAt'>
    & { shippingAddress?: AdminTypes.Maybe<Pick<AdminTypes.MailingAddress, 'address1' | 'address2' | 'city' | 'province' | 'country' | 'zip' | 'formatted' | 'name' | 'phone'>>, fulfillmentOrders: { edges: Array<{ node: (
          Pick<AdminTypes.FulfillmentOrder, 'id' | 'status'>
          & { deliveryMethod?: AdminTypes.Maybe<Pick<AdminTypes.DeliveryMethod, 'methodType'>>, lineItems: { edges: Array<{ node: (
                Pick<AdminTypes.FulfillmentOrderLineItem, 'id' | 'remainingQuantity'>
                & { lineItem: (
                  Pick<AdminTypes.LineItem, 'id' | 'name'>
                  & { variant?: AdminTypes.Maybe<(
                    Pick<AdminTypes.ProductVariant, 'id'>
                    & { inventoryItem: { measurement: { weight?: AdminTypes.Maybe<Pick<AdminTypes.Weight, 'value'>> } } }
                  )> }
                ) }
              ) }> } }
        ) }> } }
  )>> };

export type FulfillmentCreateWithTrackingMutationVariables = AdminTypes.Exact<{
  fulfillment: AdminTypes.FulfillmentInput;
}>;


export type FulfillmentCreateWithTrackingMutation = { fulfillmentCreate?: AdminTypes.Maybe<{ fulfillment?: AdminTypes.Maybe<(
      Pick<AdminTypes.Fulfillment, 'id' | 'status'>
      & { trackingInfo: Array<Pick<AdminTypes.FulfillmentTrackingInfo, 'company' | 'number' | 'url'>> }
    )>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

export type OrdersDashboardQueryVariables = AdminTypes.Exact<{
  first?: AdminTypes.InputMaybe<AdminTypes.Scalars['Int']['input']>;
  last?: AdminTypes.InputMaybe<AdminTypes.Scalars['Int']['input']>;
  after?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
  before?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
  query?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type OrdersDashboardQuery = { orders: { edges: Array<(
      Pick<AdminTypes.OrderEdge, 'cursor'>
      & { node: (
        Pick<AdminTypes.Order, 'id' | 'name' | 'createdAt'>
        & { customer?: AdminTypes.Maybe<Pick<AdminTypes.Customer, 'displayName'>>, netPaymentSet: { presentmentMoney: Pick<AdminTypes.MoneyV2, 'amount' | 'currencyCode'> } }
      ) }
    )>, pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'hasPreviousPage' | 'startCursor' | 'endCursor'> } };

export type GetOrdersPrintLabelsInputQueryVariables = AdminTypes.Exact<{
  ids: Array<AdminTypes.Scalars['ID']['input']> | AdminTypes.Scalars['ID']['input'];
}>;


export type GetOrdersPrintLabelsInputQuery = { nodes: Array<AdminTypes.Maybe<(
    Pick<AdminTypes.Order, 'id' | 'name' | 'createdAt' | 'email' | 'phone' | 'confirmationNumber'>
    & { billingAddress?: AdminTypes.Maybe<Pick<AdminTypes.MailingAddress, 'firstName' | 'lastName' | 'phone'>>, shippingLines: { edges: Array<{ node: (
          Pick<AdminTypes.ShippingLine, 'title'>
          & { taxLines: Array<Pick<AdminTypes.TaxLine, 'title' | 'ratePercentage'>> }
        ) }> }, fulfillmentOrders: { edges: Array<{ node: (
          Pick<AdminTypes.FulfillmentOrder, 'id' | 'status'>
          & { deliveryMethod?: AdminTypes.Maybe<Pick<AdminTypes.DeliveryMethod, 'methodType'>>, lineItems: { edges: Array<{ node: (
                Pick<AdminTypes.FulfillmentOrderLineItem, 'id' | 'remainingQuantity'>
                & { lineItem: (
                  Pick<AdminTypes.LineItem, 'id' | 'name' | 'sku'>
                  & { variant?: AdminTypes.Maybe<Pick<AdminTypes.ProductVariant, 'id' | 'displayName'>> }
                ) }
              ) }> } }
        ) }> }, fulfillments: Array<(
      Pick<AdminTypes.Fulfillment, 'id' | 'name' | 'displayStatus'>
      & { trackingInfo: Array<Pick<AdminTypes.FulfillmentTrackingInfo, 'number' | 'company' | 'url'>>, fulfillmentLineItems: { edges: Array<{ node: (
            Pick<AdminTypes.FulfillmentLineItem, 'quantity'>
            & { lineItem: (
              Pick<AdminTypes.LineItem, 'id' | 'name' | 'sku'>
              & { variant?: AdminTypes.Maybe<Pick<AdminTypes.ProductVariant, 'id' | 'displayName'>> }
            ) }
          ) }> } }
    )> }
  )>> };

export type AddZipCodeToOrderMutationVariables = AdminTypes.Exact<{
  input: AdminTypes.OrderInput;
}>;


export type AddZipCodeToOrderMutation = { orderUpdate?: AdminTypes.Maybe<{ order?: AdminTypes.Maybe<(
      Pick<AdminTypes.Order, 'id'>
      & { shippingAddress?: AdminTypes.Maybe<Pick<AdminTypes.MailingAddress, 'address1' | 'city' | 'provinceCode' | 'zip' | 'countryCodeV2'>> }
    )>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

export type GetOrdersShippingInfoBatchQueryVariables = AdminTypes.Exact<{
  orderIds: Array<AdminTypes.Scalars['ID']['input']> | AdminTypes.Scalars['ID']['input'];
}>;


export type GetOrdersShippingInfoBatchQuery = { nodes: Array<AdminTypes.Maybe<{ __typename: 'AbandonedCheckout' | 'AbandonedCheckoutLineItem' | 'Abandonment' | 'AddAllProductsOperation' | 'AdditionalFee' | 'App' | 'AppCatalog' | 'AppCredit' | 'AppInstallation' | 'AppPurchaseOneTime' | 'AppRevenueAttributionRecord' | 'AppSubscription' | 'AppUsageRecord' | 'Article' | 'BasicEvent' | 'Blog' | 'BulkOperation' | 'BusinessEntity' | 'CalculatedOrder' | 'CartTransform' } | { __typename: 'CashTrackingAdjustment' | 'CashTrackingSession' | 'CatalogCsvOperation' | 'Channel' | 'ChannelDefinition' | 'ChannelInformation' | 'CheckoutProfile' | 'Collection' | 'Comment' | 'CommentEvent' | 'Company' | 'CompanyAddress' | 'CompanyContact' | 'CompanyContactRole' | 'CompanyContactRoleAssignment' | 'CompanyLocation' | 'CompanyLocationCatalog' | 'CompanyLocationStaffMemberAssignment' | 'ConsentPolicy' | 'CurrencyExchangeAdjustment' } | { __typename: 'Customer' | 'CustomerAccountAppExtensionPage' | 'CustomerAccountNativePage' | 'CustomerPaymentMethod' | 'CustomerSegmentMembersQuery' | 'CustomerVisit' | 'DeliveryCarrierService' | 'DeliveryCondition' | 'DeliveryCountry' | 'DeliveryCustomization' | 'DeliveryLocationGroup' | 'DeliveryMethod' | 'DeliveryMethodDefinition' | 'DeliveryParticipant' | 'DeliveryProfile' | 'DeliveryProfileItem' | 'DeliveryPromiseParticipant' | 'DeliveryPromiseProvider' | 'DeliveryProvince' | 'DeliveryRateDefinition' } | { __typename: 'DeliveryZone' | 'DiscountAutomaticBxgy' | 'DiscountAutomaticNode' | 'DiscountCodeNode' | 'DiscountNode' | 'DiscountRedeemCodeBulkCreation' | 'Domain' | 'DraftOrder' | 'DraftOrderLineItem' | 'DraftOrderTag' | 'Duty' | 'ExchangeLineItem' | 'ExchangeV2' | 'ExternalVideo' | 'Fulfillment' | 'FulfillmentConstraintRule' | 'FulfillmentEvent' | 'FulfillmentHold' | 'FulfillmentLineItem' | 'FulfillmentOrder' } | { __typename: 'FulfillmentOrderDestination' | 'FulfillmentOrderLineItem' | 'FulfillmentOrderMerchantRequest' | 'GenericFile' | 'GiftCard' | 'GiftCardCreditTransaction' | 'GiftCardDebitTransaction' | 'InventoryAdjustmentGroup' | 'InventoryItem' | 'InventoryItemMeasurement' | 'InventoryLevel' | 'InventoryQuantity' | 'InventoryShipment' | 'InventoryShipmentLineItem' | 'InventoryTransfer' | 'InventoryTransferLineItem' | 'LineItem' | 'LineItemGroup' | 'Location' | 'MailingAddress' } | { __typename: 'Market' | 'MarketCatalog' | 'MarketRegionCountry' | 'MarketWebPresence' | 'MarketingActivity' | 'MarketingEvent' | 'MediaImage' | 'Menu' | 'Metafield' | 'MetafieldDefinition' | 'Metaobject' | 'MetaobjectDefinition' | 'Model3d' | 'OnlineStoreTheme' | 'OrderAdjustment' | 'OrderDisputeSummary' | 'OrderEditSession' | 'OrderTransaction' | 'Page' | 'PaymentCustomization' } | { __typename: 'PaymentMandate' | 'PaymentSchedule' | 'PaymentTerms' | 'PaymentTermsTemplate' | 'PointOfSaleDevice' | 'PriceList' | 'PriceRule' | 'PriceRuleDiscountCode' | 'Product' | 'ProductBundleOperation' | 'ProductDeleteOperation' | 'ProductDuplicateOperation' | 'ProductFeed' | 'ProductOption' | 'ProductOptionValue' | 'ProductSetOperation' | 'ProductTaxonomyNode' | 'ProductVariant' | 'ProductVariantComponent' | 'Publication' } | { __typename: 'PublicationResourceOperation' | 'QuantityPriceBreak' | 'Refund' | 'RefundShippingLine' | 'Return' | 'ReturnLineItem' | 'ReturnableFulfillment' | 'ReverseDelivery' | 'ReverseDeliveryLineItem' | 'ReverseFulfillmentOrder' | 'ReverseFulfillmentOrderDisposition' | 'ReverseFulfillmentOrderLineItem' | 'SaleAdditionalFee' | 'SavedSearch' | 'ScriptTag' | 'Segment' | 'SellingPlan' | 'SellingPlanGroup' | 'ServerPixel' | 'Shop' } | { __typename: 'ShopAddress' | 'ShopPolicy' | 'ShopifyPaymentsAccount' | 'ShopifyPaymentsBalanceTransaction' | 'ShopifyPaymentsBankAccount' | 'ShopifyPaymentsDispute' | 'ShopifyPaymentsDisputeEvidence' | 'ShopifyPaymentsDisputeFileUpload' | 'ShopifyPaymentsDisputeFulfillment' | 'ShopifyPaymentsPayout' | 'StaffMember' | 'StandardMetafieldDefinitionTemplate' | 'StoreCreditAccount' | 'StoreCreditAccountCreditTransaction' | 'StoreCreditAccountDebitRevertTransaction' | 'StoreCreditAccountDebitTransaction' | 'StorefrontAccessToken' | 'SubscriptionBillingAttempt' | 'SubscriptionContract' | 'SubscriptionDraft' } | { __typename: 'TaxonomyAttribute' | 'TaxonomyCategory' | 'TaxonomyChoiceListAttribute' | 'TaxonomyMeasurementAttribute' | 'TaxonomyValue' | 'TenderTransaction' | 'TransactionFee' | 'UnverifiedReturnLineItem' | 'UrlRedirect' | 'UrlRedirectImport' | 'Validation' | 'Video' | 'WebPixel' | 'WebhookSubscription' } | (
    { __typename: 'Order' }
    & Pick<AdminTypes.Order, 'id' | 'name'>
    & { shippingAddress?: AdminTypes.Maybe<Pick<AdminTypes.MailingAddress, 'zip' | 'address1' | 'city' | 'provinceCode'>>, shippingLines: { edges: Array<{ node: (
          Pick<AdminTypes.ShippingLine, 'title'>
          & { taxLines: Array<Pick<AdminTypes.TaxLine, 'title' | 'ratePercentage'>> }
        ) }> } }
  )>> };

interface GeneratedQueryTypes {
  "#graphql\n  query GetOrdersTrackingInputData($ids: [ID!]!) {\n    nodes(ids: $ids) {\n      ... on Order {\n        id\n        name\n        email\n        phone\n        createdAt\n        shippingAddress {\n          address1\n          address2\n          city\n          province\n          country\n          zip\n          formatted\n          name\n          phone\n        }\n        fulfillmentOrders(first: 50) {\n          edges {\n            node {\n              id\n              status\n              deliveryMethod {\n                methodType\n              }\n              lineItems(first: 250) {\n                edges {\n                  node {\n                    id\n                    remainingQuantity\n                    lineItem {\n                      id\n                      name\n                      variant {\n                        id\n                        inventoryItem{\n                          measurement {\n                            weight {\n                              value \n                            }\n                          }\n                        }\n                      }\n                    }\n                  }\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n": {return: GetOrdersTrackingInputDataQuery, variables: GetOrdersTrackingInputDataQueryVariables},
  "#graphql\n  query OrdersDashboard(\n    $first: Int\n    $last: Int\n    $after: String\n    $before: String\n    $query: String\n  ) {\n    orders(\n      first: $first\n      last: $last\n      after: $after\n      before: $before\n      query: $query\n      sortKey: CREATED_AT\n      reverse: true\n    ) {\n      edges {\n        cursor\n        node {\n          id\n          name\n          createdAt\n          \n          customer {\n            displayName\n          }\n          \n          netPaymentSet {\n            presentmentMoney {\n              amount\n              currencyCode\n            }\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n    }\n  }\n": {return: OrdersDashboardQuery, variables: OrdersDashboardQueryVariables},
  "#graphql\n  query GetOrdersPrintLabelsInput($ids: [ID!]!) {\n    nodes(ids: $ids) {\n      ... on Order {\n        id\n        name\n        createdAt\n        email\n        phone\n        confirmationNumber\n        billingAddress {\n          firstName\n          lastName\n          phone\n        }\n        shippingLines(first: 10) {\n          edges {\n            node {\n              title\n              taxLines {\n                title\n                ratePercentage\n              }\n            }\n          }\n        }\n\n        fulfillmentOrders(first: 50) {\n          edges {\n            node {\n              id\n              status\n              deliveryMethod {\n                methodType\n              }\n              lineItems(first: 100) {\n                edges {\n                  node {\n                    id\n                    remainingQuantity\n                    lineItem {\n                      id\n                      name\n                      sku\n                      variant {\n                        id\n                        displayName\n                      }\n                    }\n                  }\n                }\n              }\n            }\n          }\n        }\n\n        fulfillments(first: 50) {\n          id\n          name\n          displayStatus\n          trackingInfo {\n            number\n            company\n            url\n          }\n          fulfillmentLineItems(first: 100) {\n            edges {\n              node {\n                quantity\n                lineItem {\n                  id\n                  name\n                  sku\n                  variant {\n                    id\n                    displayName\n                  }\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n": {return: GetOrdersPrintLabelsInputQuery, variables: GetOrdersPrintLabelsInputQueryVariables},
  "#graphql\n  query GetOrdersShippingInfoBatch($orderIds: [ID!]!) {\n    nodes(ids: $orderIds) {\n      __typename\n      ... on Order {\n        id\n        name\n        shippingAddress {\n          zip\n          address1\n          city\n          provinceCode\n        }\n        shippingLines(first: 2) {\n          edges {\n            node {\n              title\n              taxLines {\n                title\n                ratePercentage\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n": {return: GetOrdersShippingInfoBatchQuery, variables: GetOrdersShippingInfoBatchQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\n  mutation FulfillmentCreateWithTracking($fulfillment: FulfillmentInput!) {\n    fulfillmentCreate(fulfillment: $fulfillment) {\n      fulfillment {\n        id\n        status\n        trackingInfo(first: 10) {\n          company\n          number\n          url\n        }\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }\n": {return: FulfillmentCreateWithTrackingMutation, variables: FulfillmentCreateWithTrackingMutationVariables},
  "#graphql\n  mutation AddZipCodeToOrder($input: OrderInput!) {\n    orderUpdate(input: $input) {\n      order {\n        id\n        shippingAddress {\n          address1\n          city\n          provinceCode\n          zip\n          countryCodeV2\n        }\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }\n": {return: AddZipCodeToOrderMutation, variables: AddZipCodeToOrderMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
