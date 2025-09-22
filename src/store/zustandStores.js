import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Reservation store for handling reservations
export const useReservationStore = create(
  persist(
    (set, get) => ({
      reservations: [],
      currentReservation: null,
      addReservation: (reservation) =>
        set((state) => ({
          reservations: [...state.reservations, { ...reservation, id: Date.now() }],
        })),
      setCurrentReservation: (reservation) => set({ currentReservation: reservation }),
      clearCurrentReservation: () => set({ currentReservation: null }),
      removeReservation: (id) =>
        set((state) => ({
          reservations: state.reservations.filter((res) => res.id !== id),
        })),
    }),
    {
      name: 'reservation-storage',
    }
  )
);

// Filter store for menu filtering
export const useFilterStore = create((set, get) => ({
  selectedCategory: 'all',
  priceRange: [0, 100],
  searchTerm: '',
  showAvailableOnly: false,
  sortBy: 'name',
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  setPriceRange: (range) => set({ priceRange: range }),
  setSearchTerm: (term) => set({ searchTerm: term }),
  toggleAvailableOnly: () => set((state) => ({ showAvailableOnly: !state.showAvailableOnly })),
  setSortBy: (sortBy) => set({ sortBy }),
  clearFilters: () => set({
    selectedCategory: 'all',
    priceRange: [0, 100],
    searchTerm: '',
    showAvailableOnly: false,
    sortBy: 'name',
  }),
}));

// Preferences store for user preferences
export const usePreferencesStore = create(
  persist(
    (set, get) => ({
      favoriteItems: [],
      dietaryPreferences: [],
      addFavorite: (itemId) =>
        set((state) => ({
          favoriteItems: [...new Set([...state.favoriteItems, itemId])],
        })),
      removeFavorite: (itemId) =>
        set((state) => ({
          favoriteItems: state.favoriteItems.filter((id) => id !== itemId),
        })),
      setDietaryPreferences: (preferences) => set({ dietaryPreferences: preferences }),
      isFavorite: (itemId) => get().favoriteItems.includes(itemId),
    }),
    {
      name: 'preferences-storage',
    }
  )
);