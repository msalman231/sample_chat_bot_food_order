import React from 'react';
import { useDispatch } from 'react-redux';
import { setActiveSection } from '../store/uiSlice';

const Hero = () => {
  const dispatch = useDispatch();
  
  const scrollToMenu = () => {
    dispatch(setActiveSection('menu'));
    const element = document.getElementById('menu');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  return (
    <section id="home" className="relative h-screen flex items-center justify-center overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200)',
        }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-50"></div>
      </div>
      
      <div className="relative z-10 text-center text-white px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl md:text-6xl font-heading font-bold mb-6">
          Welcome to
          <span className="block text-primary-400">Bella Vista</span>
        </h1>
        <p className="text-xl md:text-2xl mb-8 max-w-2xl mx-auto">
          Experience authentic Italian cuisine in an elegant atmosphere.
          Fresh ingredients, traditional recipes, and modern culinary artistry.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button 
            onClick={scrollToMenu}
            className="btn-primary text-lg px-8 py-4 hover:transform hover:scale-105 transition-all duration-300"
          >
            View Our Menu
          </button>
          <button 
            onClick={() => {
              dispatch(setActiveSection('contact'));
              const element = document.getElementById('contact');
              if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="btn-secondary text-lg px-8 py-4 hover:transform hover:scale-105 transition-all duration-300 bg-white text-primary-600 hover:bg-gray-100"
          >
            Make Reservation
          </button>
        </div>
      </div>
      
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <svg className="w-6 h-6 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
        </svg>
      </div>
    </section>
  );
};

export default Hero;