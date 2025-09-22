import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  type MenuItem {
    id: ID!
    name: String!
    description: String!
    price: Float!
    category: String!
    image: String
    available: Boolean!
    ingredients: [String!]!
  }

  type Restaurant {
    id: ID!
    name: String!
    description: String!
    address: String!
    phone: String!
    email: String!
    hours: [String!]!
    images: [String!]!
    aboutText: String!
  }

  type Reservation {
    id: ID!
    name: String!
    email: String!
    phone: String!
    date: String!
    time: String!
    guests: Int!
    specialRequests: String
    status: String!
  }

  type ContactMessage {
    id: ID!
    name: String!
    email: String!
    subject: String!
    message: String!
    timestamp: String!
  }

  type ContactResponse {
    success: Boolean!
    message: String!
  }

  input ReservationInput {
    name: String!
    email: String!
    phone: String!
    date: String!
    time: String!
    guests: Int!
    specialRequests: String
  }

  input ContactInput {
    name: String!
    email: String!
    subject: String!
    message: String!
  }

  type Query {
    menuItems: [MenuItem!]!
    menuItem(id: ID!): MenuItem
    menuItemsByCategory(category: String!): [MenuItem!]!
    restaurant: Restaurant!
    reservations: [Reservation!]!
    contactMessages: [ContactMessage!]!
  }

  type Mutation {
    createReservation(input: ReservationInput!): Reservation!
    sendContactMessage(input: ContactInput!): ContactResponse!
  }
`;