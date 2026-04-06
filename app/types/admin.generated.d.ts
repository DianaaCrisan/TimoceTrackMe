/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types.d.ts';

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
  "#graphql\n  query OrdersDashboard($first: Int, $last: Int, $after: String, $before: String) {\n    orders(first: $first, last: $last, after: $after, before: $before) {\n      edges {\n        cursor\n        node {\n          id\n          name\n          createdAt\n        }\n      }\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n    }\n  }\n": {return: OrdersDashboardQuery, variables: OrdersDashboardQueryVariables},
}

interface GeneratedMutationTypes {
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
