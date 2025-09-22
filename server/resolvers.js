import { menuItems, restaurantData, reservations, contactMessages } from './data.js';

export const resolvers = {
  Query: {
    menuItems: () => menuItems,
    menuItem: (parent, { id }) => menuItems.find(item => item.id === id),
    menuItemsByCategory: (parent, { category }) => 
      menuItems.filter(item => item.category.toLowerCase() === category.toLowerCase()),
    restaurant: () => restaurantData,
    reservations: () => reservations,
    contactMessages: () => contactMessages,
  },
  
  Mutation: {
    createReservation: (parent, { input }) => {
      const newReservation = {
        id: (reservations.length + 1).toString(),
        ...input,
        status: 'pending'
      };
      reservations.push(newReservation);
      return newReservation;
    },
    
    sendContactMessage: (parent, { input }) => {
      const newMessage = {
        id: (contactMessages.length + 1).toString(),
        ...input,
        timestamp: new Date().toISOString()
      };
      contactMessages.push(newMessage);
      console.log('Contact message received:', input);
      return {
        success: true,
        message: 'Thank you for your message! We will get back to you soon.'
      };
    },
  },
};