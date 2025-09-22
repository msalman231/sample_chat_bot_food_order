import React from 'react';
import { useQuery } from '@apollo/client';
import { GET_MENU_ITEMS } from '../apollo/queries';
import { useDispatch } from 'react-redux';
import { addToCart } from '../store/cartSlice';
import { useFilterStore } from '../store/zustandStores';

const Menu = () => {
  const { loading, error, data } = useQuery(GET_MENU_ITEMS);
  const dispatch = useDispatch();
  const { selectedCategory, searchTerm } = useFilterStore();
  
  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
    </div>
  );
  
  if (error) return (
    <div className="text-center text-red-600 p-8">
      <p>Error loading menu: {error.message}</p>
    </div>
  );
  
  const menuItems = data?.menuItems || [];
  
  // Filter menu items
  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  
  const categories = ['all', ...new Set(menuItems.map(item => item.category))];
  
  const handleAddToCart = (item) => {
    dispatch(addToCart(item));
  };
  
  return (
    <section id="menu" className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 mb-4">
            Our Menu
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">
            Discover our carefully crafted dishes made with the finest ingredients
          </p>
          
          {/* Voice & Chat Ordering CTA */}
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 max-w-md mx-auto">
            <div className="flex items-center justify-center space-x-3">
              <div className="text-2xl">💬</div>
              <div className="text-left">
                <p className="text-sm font-medium text-primary-900">Try Chat Ordering!</p>
                <p className="text-xs text-primary-700">Click the floating chat button to order with voice or text</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          {categories.map(category => (
            <CategoryButton key={category} category={category} />
          ))}
        </div>
        
        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredItems.map(item => (
            <MenuItemCard key={item.id} item={item} onAddToCart={handleAddToCart} />
          ))}
        </div>
      </div>
    </section>
  );
};

const CategoryButton = ({ category }) => {
  const { selectedCategory, setSelectedCategory } = useFilterStore();
  const isActive = selectedCategory === category;
  
  return (
    <button
      onClick={() => setSelectedCategory(category)}
      className={`px-6 py-2 rounded-full font-medium transition-colors duration-200 ${
        isActive
          ? 'bg-primary-600 text-white'
          : 'bg-white text-gray-700 hover:bg-primary-50 hover:text-primary-600'
      }`}
    >
      {category.charAt(0).toUpperCase() + category.slice(1)}
    </button>
  );
};

const MenuItemCard = ({ item, onAddToCart }) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <img
        src={item.image || 'https://via.placeholder.com/400x300'}
        alt={item.name}
        className="w-full h-48 object-cover"
      />
      <div className="p-6">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-semibold text-gray-900">{item.name}</h3>
          <span className="text-primary-600 font-bold text-lg">${item.price}</span>
        </div>
        <p className="text-gray-600 mb-4">{item.description}</p>
        <div className="flex flex-wrap gap-1 mb-4">
          {item.ingredients.map((ingredient, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
            >
              {ingredient}
            </span>
          ))}
        </div>
        <button
          onClick={() => onAddToCart(item)}
          disabled={!item.available}
          className={`w-full py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${
            item.available
              ? 'bg-primary-600 hover:bg-primary-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {item.available ? 'Add to Cart' : 'Unavailable'}
        </button>
      </div>
    </div>
  );
};

export default Menu;