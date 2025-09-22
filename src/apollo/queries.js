import { gql } from '@apollo/client';

// Query to get all menu items
export const GET_MENU_ITEMS = gql`
  query GetMenuItems {
    menuItems {
      id
      name
      description
      price
      category
      image
      available
      ingredients
    }
  }
`;

// Query to get restaurant information
export const GET_RESTAURANT_INFO = gql`
  query GetRestaurantInfo {
    restaurant {
      id
      name
      description
      address
      phone
      email
      hours
      images
      aboutText
    }
  }
`;

// Query to get menu items by category
export const GET_MENU_BY_CATEGORY = gql`
  query GetMenuByCategory($category: String!) {
    menuItemsByCategory(category: $category) {
      id
      name
      description
      price
      category
      image
      available
      ingredients
    }
  }
`;

// Query to get single menu item
export const GET_MENU_ITEM = gql`
  query GetMenuItem($id: ID!) {
    menuItem(id: $id) {
      id
      name
      description
      price
      category
      image
      available
      ingredients
    }
  }
`;

// Mutation to create a reservation
export const CREATE_RESERVATION = gql`
  mutation CreateReservation($input: ReservationInput!) {
    createReservation(input: $input) {
      id
      name
      email
      phone
      date
      time
      guests
      specialRequests
      status
    }
  }
`;

// Mutation to send contact message
export const SEND_CONTACT_MESSAGE = gql`
  mutation SendContactMessage($input: ContactInput!) {
    sendContactMessage(input: $input) {
      success
      message
    }
  }
`;