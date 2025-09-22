// Mock data for the restaurant
export const restaurantData = {
  id: '1',
  name: 'Bella Vista Restaurant',
  description: 'Authentic Italian cuisine in the heart of the city',
  address: '123 Main Street, Downtown, City 12345',
  phone: '+1 (555) 123-4567',
  email: 'info@bellavista.com',
  hours: [
    'Monday: 11:00 AM - 10:00 PM',
    'Tuesday: 11:00 AM - 10:00 PM',
    'Wednesday: 11:00 AM - 10:00 PM',
    'Thursday: 11:00 AM - 10:00 PM',
    'Friday: 11:00 AM - 11:00 PM',
    'Saturday: 10:00 AM - 11:00 PM',
    'Sunday: 10:00 AM - 9:00 PM'
  ],
  images: [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
    'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800'
  ],
  aboutText: 'Bella Vista Restaurant has been serving authentic Italian cuisine for over 25 years. Our chefs use only the finest imported ingredients and traditional recipes passed down through generations. From handmade pasta to wood-fired pizzas, every dish is crafted with love and attention to detail.'
};

export const menuItems = [
  {
    id: '1',
    name: 'Margherita Pizza',
    description: 'Classic pizza with fresh mozzarella, tomato sauce, and basil',
    price: 18.99,
    category: 'Pizza',
    image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=600',
    available: true,
    ingredients: ['Mozzarella', 'Tomato Sauce', 'Fresh Basil', 'Olive Oil']
  },
  {
    id: '2',
    name: 'Spaghetti Carbonara',
    description: 'Traditional Roman pasta with eggs, cheese, pancetta, and pepper',
    price: 22.99,
    category: 'Pasta',
    image: 'https://rb.gy/8dka3t',
    available: true,
    ingredients: ['Spaghetti', 'Eggs', 'Parmesan Cheese', 'Pancetta', 'Black Pepper']
  },
  {
    id: '3',
    name: 'Caesar Salad',
    description: 'Crisp romaine lettuce with Caesar dressing, croutons, and parmesan',
    price: 14.99,
    category: 'Salads',
    image: 'https://images.unsplash.com/photo-1551248429-40975aa4de74?w=600',
    available: true,
    ingredients: ['Romaine Lettuce', 'Caesar Dressing', 'Croutons', 'Parmesan Cheese']
  },
  {
    id: '4',
    name: 'Grilled Salmon',
    description: 'Fresh Atlantic salmon with lemon herb butter and seasonal vegetables',
    price: 28.99,
    category: 'Seafood',
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600',
    available: true,
    ingredients: ['Atlantic Salmon', 'Lemon', 'Herbs', 'Butter', 'Seasonal Vegetables']
  },
  {
    id: '5',
    name: 'Tiramisu',
    description: 'Classic Italian dessert with coffee-soaked ladyfingers and mascarpone',
    price: 8.99,
    category: 'Desserts',
    image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600',
    available: true,
    ingredients: ['Ladyfingers', 'Coffee', 'Mascarpone', 'Cocoa Powder', 'Sugar']
  },
  {
    id: '6',
    name: 'Bruschetta',
    description: 'Grilled bread topped with fresh tomatoes, garlic, and basil',
    price: 12.99,
    category: 'Appetizers',
    image: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=600',
    available: true,
    ingredients: ['Bread', 'Tomatoes', 'Garlic', 'Basil', 'Olive Oil']
  },
  {
    id: '7',
    name: 'Fettuccine Alfredo',
    description: 'Creamy pasta with parmesan cheese and butter',
    price: 20.99,
    category: 'Pasta',
    image: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=600',
    available: true,
    ingredients: ['Fettuccine', 'Parmesan Cheese', 'Butter', 'Heavy Cream']
  },
  {
    id: '8',
    name: 'Pepperoni Pizza',
    description: 'Classic pizza with pepperoni and mozzarella cheese',
    price: 21.99,
    category: 'Pizza',
    image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600',
    available: true,
    ingredients: ['Pepperoni', 'Mozzarella', 'Tomato Sauce']
  },
  {
    id: '9',
    name: 'Grilled Shrimp',
    description: 'Perfectly seasoned grilled shrimp with garlic and herbs',
    price: 24.99,
    category: 'Seafood',
    image: 'https://images.unsplash.com/photo-1559847844-d90fe0a3c8d6?w=600',
    available: true,
    ingredients: ['Shrimp', 'Garlic', 'Herbs', 'Lemon', 'Olive Oil']
  },
  {
    id: '10',
    name: 'Fish and Chips',
    description: 'Crispy battered fish with golden fries and tartar sauce',
    price: 19.99,
    category: 'Seafood',
    image: 'https://images.unsplash.com/photo-1579208570378-8c970854bc23?w=600',
    available: true,
    ingredients: ['White Fish', 'Batter', 'Potatoes', 'Tartar Sauce']
  },
  // Addon Items
  {
    id: 'addon-1',
    name: 'Water Bottle',
    description: 'Refreshing mineral water bottle (500ml)',
    price: 2.99,
    category: 'Beverages',
    image: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=600',
    available: true,
    ingredients: ['Mineral Water'],
    isAddon: true
  },
  {
    id: 'addon-2',
    name: 'Fresh Orange Juice',
    description: 'Freshly squeezed orange juice',
    price: 4.99,
    category: 'Beverages',
    image: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=600',
    available: true,
    ingredients: ['Fresh Oranges'],
    isAddon: true
  },
  {
    id: 'addon-3',
    name: 'Apple Juice Can',
    description: 'Canned apple juice (330ml)',
    price: 3.49,
    category: 'Beverages',
    image: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=600',
    available: true,
    ingredients: ['Apple Juice'],
    isAddon: true
  },
  {
    id: 'addon-4',
    name: 'Garden Salad',
    description: 'Fresh mixed greens with cherry tomatoes and cucumber',
    price: 6.99,
    category: 'Sides',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600',
    available: true,
    ingredients: ['Mixed Greens', 'Cherry Tomatoes', 'Cucumber', 'Dressing'],
    isAddon: true
  },
  {
    id: 'addon-5',
    name: 'Tomato Ketchup',
    description: 'Premium tomato ketchup packet',
    price: 0.99,
    category: 'Condiments',
    image: 'https://images.unsplash.com/photo-1571104508999-893933ded431?w=600',
    available: true,
    ingredients: ['Tomatoes', 'Vinegar', 'Sugar', 'Spices'],
    isAddon: true
  },
  {
    id: 'addon-6',
    name: 'Green Chilli',
    description: 'Fresh green chilli peppers',
    price: 1.49,
    category: 'Condiments',
    image: 'https://images.unsplash.com/photo-1583280281896-9d71b03df91c?w=600',
    available: true,
    ingredients: ['Green Chilli Peppers'],
    isAddon: true
  },
  {
    id: 'addon-7',
    name: 'Sliced Onions',
    description: 'Fresh sliced red onions',
    price: 1.99,
    category: 'Condiments',
    image: 'https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?w=600',
    available: true,
    ingredients: ['Red Onions'],
    isAddon: true
  },
  {
    id: 'addon-8',
    name: 'Extra Cheese',
    description: 'Additional mozzarella cheese',
    price: 2.49,
    category: 'Extras',
    image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=600',
    available: true,
    ingredients: ['Mozzarella Cheese'],
    isAddon: true
  },
  {
    id: 'addon-9',
    name: 'Garlic Bread',
    description: 'Toasted bread with garlic butter',
    price: 3.99,
    category: 'Sides',
    image: 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=600',
    available: true,
    ingredients: ['Bread', 'Garlic', 'Butter', 'Herbs'],
    isAddon: true
  }
];

// In-memory storage for reservations
export let reservations = [];

// In-memory storage for contact messages
export let contactMessages = [];