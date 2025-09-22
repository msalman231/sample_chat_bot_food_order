import { createSlice } from '@reduxjs/toolkit';

// UI slice for managing UI state
const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    isMenuOpen: false,
    activeSection: 'home',
    isLoading: false,
    notification: null,
    theme: 'light',
    showAdmin: false,
  },
  reducers: {
    toggleMobileMenu: (state) => {
      state.isMenuOpen = !state.isMenuOpen;
    },
    setActiveSection: (state, action) => {
      state.activeSection = action.payload;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    showNotification: (state, action) => {
      state.notification = {
        message: action.payload.message,
        type: action.payload.type || 'info',
        id: Date.now(),
      };
    },
    hideNotification: (state) => {
      state.notification = null;
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },
    toggleAdmin: (state) => {
      state.showAdmin = !state.showAdmin;
    },
  },
});

export const {
  toggleMobileMenu,
  setActiveSection,
  setLoading,
  showNotification,
  hideNotification,
  toggleTheme,
  toggleAdmin,
} = uiSlice.actions;

export default uiSlice.reducer;