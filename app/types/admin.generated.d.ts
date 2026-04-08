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
}>;


export type OrdersDashboardQuery = { orders: { edges: Array<(
      Pick<AdminTypes.OrderEdge, 'cursor'>
      & { node: Pick<AdminTypes.Order, 'id' | 'name' | 'createdAt'> }
    )>, pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'hasPreviousPage' | 'startCursor' | 'endCursor'> } };

interface GeneratedQueryTypes {
  "#graphql\n  query GetOrdersTrackingInputData($ids: [ID!]!) {\n    nodes(ids: $ids) {\n      ... on Order {\n        id\n        name\n        email\n        phone\n        createdAt\n        shippingAddress {\n          address1\n          address2\n          city\n          province\n          country\n          zip\n          formatted\n          name\n          phone\n        }\n        fulfillmentOrders(first: 20) {\n          edges {\n            node {\n              id\n              status\n              deliveryMethod {\n                methodType\n              }\n              lineItems(first: 50) {\n                edges {\n                  node {\n                    id\n                    remainingQuantity\n                    lineItem {\n                      id\n                      name\n                      variant {\n                        id\n                        inventoryItem{\n                          measurement {\n                            weight {\n                              value \n                            }\n                          }\n                        }\n                      }\n                    }\n                  }\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n": {return: GetOrdersTrackingInputDataQuery, variables: GetOrdersTrackingInputDataQueryVariables},
  "#graphql\n  query OrdersDashboard($first: Int, $last: Int, $after: String, $before: String) {\n    orders(\n      first: $first\n      last: $last\n      after: $after\n      before: $before\n      sortKey: CREATED_AT\n      reverse: true\n    ) {\n        edges {\n          cursor\n          node {\n            id\n            name\n            createdAt\n          }\n        }\n        pageInfo {\n          hasNextPage\n          hasPreviousPage\n          startCursor\n          endCursor\n        }\n      }\n    }\n": {return: OrdersDashboardQuery, variables: OrdersDashboardQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\n  mutation FulfillmentCreateWithTracking($fulfillment: FulfillmentInput!) {\n    fulfillmentCreate(fulfillment: $fulfillment) {\n      fulfillment {\n        id\n        status\n        trackingInfo(first: 10) {\n          company\n          number\n          url\n        }\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }\n": {return: FulfillmentCreateWithTrackingMutation, variables: FulfillmentCreateWithTrackingMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
