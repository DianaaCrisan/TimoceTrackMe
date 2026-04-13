// TODO: add pagination
export const GET_ORDERS_PRINT_LABELS_INPUT_QUERY = `#graphql
  query GetOrdersPrintLabelsInput($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Order {
        id
        name
        createdAt
        email
        phone
        confirmationNumber
        billingAddress {
          firstName
          lastName
          phone
        }
        shippingLines(first: 10) {
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

        fulfillmentOrders(first: 50) {
          edges {
            node {
              id
              status
              deliveryMethod {
                methodType
              }
              lineItems(first: 250) {
                edges {
                  node {
                    id
                    remainingQuantity
                    lineItem {
                      id
                      name
                      sku
                      variant {
                        id
                        displayName
                      }
                    }
                  }
                }
              }
            }
          }
        }

        fulfillments(first: 50) {
          id
          name
          displayStatus
          trackingInfo {
            number
            company
            url
          }
          fulfillmentLineItems(first: 250) {
            edges {
              node {
                quantity
                lineItem {
                  id
                  name
                  sku
                  variant {
                    id
                    displayName
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;
