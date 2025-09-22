import { createSlice } from '@reduxjs/toolkit';

// Cart slice for managing cart state
const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    items: [],
    totalAmount: 0,
    isOpen: false,
  },
  reducers: {
    addToCart: (state, action) => {
      const newItem = action.payload;
      const quantity = newItem.quantity || 1; // Allow quantity to be passed directly
      const existingItem = state.items.find(item => item.id === newItem.id);
      
      if (existingItem) {
        existingItem.quantity += quantity;
        existingItem.totalPrice = existingItem.price * existingItem.quantity;
      } else {
        state.items.push({
          ...newItem,
          quantity: quantity,
          totalPrice: newItem.price * quantity,
        });
      }
      
      state.totalAmount = state.items.reduce((sum, item) => sum + item.totalPrice, 0);
    },
    removeFromCart: (state, action) => {
      const id = action.payload;
      state.items = state.items.filter(item => item.id !== id);
      state.totalAmount = state.items.reduce((sum, item) => sum + item.totalPrice, 0);
    },
    updateQuantity: (state, action) => {
      const { id, quantity } = action.payload;
      const existingItem = state.items.find(item => item.id === id);
      
      if (existingItem) {
        existingItem.quantity = quantity;
        existingItem.totalPrice = existingItem.price * quantity;
      }
      
      state.totalAmount = state.items.reduce((sum, item) => sum + item.totalPrice, 0);
    },
    clearCart: (state) => {
      state.items = [];
      state.totalAmount = 0;
    },
    toggleCart: (state) => {
      state.isOpen = !state.isOpen;
    },
  },
});

export const { addToCart, removeFromCart, updateQuantity, clearCart, toggleCart } = cartSlice.actions;
export default cartSlice.reducer;