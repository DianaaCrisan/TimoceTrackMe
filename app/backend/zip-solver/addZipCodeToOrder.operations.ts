export const ADD_ZIP_CODE_TO_ORDER_MUTATION = `#graphql
  mutation AddZipCodeToOrder($input: OrderInput!) {
    orderUpdate(input: $input) {
      order {
        id
        shippingAddress {
          address1
          city
          provinceCode
          zip
          countryCodeV2
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;
