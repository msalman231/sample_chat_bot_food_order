import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { toggleMobileMenu, setActiveSection, toggleAdmin } from '../store/uiSlice';
import { toggleCart } from '../store/cartSlice';

const Header = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMenuOpen, activeSection } = useSelector((state) => state.ui);
  const { items } = useSelector((state) => state.cart);
  
  const navigation = [
    { name: 'Home', id: 'home' },
    { name: 'Menu', id: 'menu' },
    { name: 'About', id: 'about' },
    { name: 'Contact', id: 'contact' },
  ];
  
  const scrollToSection = (sectionId) => {
    // If we're on admin page, go back to main page first
    if (location.pathname === '/admin') {
      navigate('/');
      setTimeout(() => {
        dispatch(setActiveSection(sectionId));
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } else {
      dispatch(setActiveSection(sectionId));
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
    dispatch(toggleMobileMenu());
  };
  
  const handleAdminToggle = () => {
    if (location.pathname === '/admin') {
      navigate('/');
    } else {
      navigate('/admin');
    }
  };
  
  const cartItemsCount = items.reduce((total, item) => total + item.quantity, 0);
  
  return (
    <header className="bg-white shadow-lg fixed w-full container mx-auto top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4 min-h-[4rem] max-w-full overflow-hidden">
          {/* Logo */}
          <div className="flex-shrink-0 min-w-0 max-w-[200px]">
            <button 
              onClick={() => navigate('/')}
              className="text-2xl font-heading font-bold text-primary-600 hover:text-primary-700 transition-colors truncate block"
            >
              Bella Vista
            </button>
          </div>
          
          {/* Center Navigation - Only show on main website */}
          <div className="flex-1 flex justify-center px-4 min-w-0">
            {location.pathname === '/' && (
              <nav className="hidden md:flex space-x-8">
                {navigation.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`text-sm font-medium transition-colors duration-200 whitespace-nowrap ${
                      activeSection === item.id
                        ? 'text-primary-600 border-b-2 border-primary-600 pb-1'
                        : 'text-gray-700 hover:text-primary-600'
                    }`}
                  >
                    {item.name}
                  </button>
                ))}
              </nav>
            )}
            
            {/* Admin page title */}
            {location.pathname === '/admin' && (
              <div className="hidden md:block">
                <h2 className="text-lg font-semibold text-gray-900">Admin Panel</h2>
              </div>
            )}
          </div>
          
          {/* Right side controls */}
          <div className="flex items-center flex-shrink-0 mr-8 min-w-0 max-w-[200px]">
            <div className="flex items-center space-x-1 sm:space-x-2 w-full justify-end">
              {/* Admin Toggle Button */}
              <button
                onClick={handleAdminToggle}
                className="px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors flex-shrink-0"
                title={location.pathname === '/admin' ? 'View Website' : 'View Admin Panel'}
              >
                <span className="hidden sm:inline whitespace-nowrap">{location.pathname === '/admin' ? '🌐 Website' : '⚙️ Admin'}</span>
                <span className="sm:hidden">{location.pathname === '/admin' ? '🌐' : '⚙️'}</span>
              </button>
              
              {/* Cart Button - Only show on main website */}
              {location.pathname === '/' && (
                <button
                  onClick={() => dispatch(toggleCart())}
                  className="relative p-2 text-gray-700 hover:text-primary-600 transition-colors flex-shrink-0"
                >
                  <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M3 3h2l.4 2M7 13h10l4-8H5.4m7.2 8L9 17a2 2 0 1 0 2 2h7a2 2 0 1 0 2-2H9" />
                  </svg>
                  {cartItemsCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center font-medium min-w-0">
                      <span className="text-xs leading-none">{cartItemsCount > 99 ? '99+' : cartItemsCount}</span>
                    </span>
                  )}
                </button>
              )}
              
              {/* Mobile Menu Button */}
              <button
                onClick={() => dispatch(toggleMobileMenu())}
                className="md:hidden p-2 text-gray-700 hover:text-primary-600 transition-colors flex-shrink-0"
              >
                <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  {isMenuOpen ? (
                    <path d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden pb-4">
            <div className="flex flex-col space-y-2">
              {location.pathname === '/' && navigation.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`text-left px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                    activeSection === item.id
                      ? 'text-primary-600 bg-primary-50'
                      : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                  }`}
                >
                  {item.name}
                </button>
              ))}
              {location.pathname === '/admin' && (
                <div className="px-3 py-2 text-sm text-gray-600">
                  Admin Panel
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;