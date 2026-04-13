export const GET_ORDERS_TRACKING_INPUT_DATA_QUERY = `#graphql
  query GetOrdersTrackingInputData($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Order {
        id
        name
        email
        phone
        createdAt
        shippingAddress {
          address1
          address2
          city
          province
          country
          zip
          formatted
          name
          phone
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
                      variant {
                        id
                        inventoryItem{
                          measurement {
                            weight {
                              value 
                            }
                          }
                        }
                      }
                    }
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

export const FULFILLMENT_CREATE_WITH_TRACKING_MUTATION = `#graphql
  mutation FulfillmentCreateWithTracking($fulfillment: FulfillmentInput!) {
    fulfillmentCreate(fulfillment: $fulfillment) {
      fulfillment {
        id
        status
        trackingInfo(first: 10) {
          company
          number
          url
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;
