// TODO: add pagination
export const GET_ORDERS_SHIPPING_INFO_BATCH_QUERY = `#graphql
  query GetOrdersShippingInfoBatch($orderIds: [ID!]!) {
    nodes(ids: $orderIds) {
      __typename
      ... on Order {
        id
        name
        shippingAddress {
          zip
          address1
          city
          provinceCode
        }
        shippingLines(first: 2) {
          edges {
            node {
              title
              taxLines {
                title
                ratePercentage
              }
            }
          }
        }
      }
    }
  }
`;
