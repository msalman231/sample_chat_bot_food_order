import React, { useEffect, useState } from 'react';
import { Provider, useSelector, useDispatch } from 'react-redux';
import { ApolloProvider } from '@apollo/client';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import store from './store';
import client from './apollo/client';
import Header from './components/Header';
import Hero from './components/Hero';
import Menu from './components/Menu';
import About from './components/About';
import Contact from './components/Contact';
import Cart from './components/Cart';
import AdminPanel from './components/AdminPanel';
import ChatBot from './components/ChatBot';
import { toggleAdmin } from './store/uiSlice';
import './App.css';

const MainWebsite = () => {
  const [isChatBotOpen, setIsChatBotOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main>
        <Hero />
        <Menu />
        <About />
        <Contact />
      </main>
      <Cart />
      
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsChatBotOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-40 group"
        title="Chat Assistant - Order with voice or text!"
      >
        <svg className="w-7 h-7 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
        </svg>
        
        {/* Notification dot */}
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">💬</span>
        </div>
        
        {/* Pulse animation */}
        <div className="absolute inset-0 rounded-full bg-primary-600 opacity-30 animate-ping"></div>
      </button>
      
      {/* ChatBot Modal */}
      <ChatBot 
        isOpen={isChatBotOpen} 
        onClose={() => setIsChatBotOpen(false)} 
      />
    </div>
  );
};

const AppContent = () => {
  const dispatch = useDispatch();
  const { showAdmin } = useSelector((state) => state.ui);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Handle admin state synchronization with URL
  useEffect(() => {
    const isAdminPath = location.pathname === '/admin';
    
    // Only update if there's a mismatch to prevent infinite loops
    if (isAdminPath !== showAdmin) {
      dispatch(toggleAdmin());
    }
  }, [location.pathname, dispatch]); // Remove showAdmin from dependencies to prevent loops
  
  return (
    <Routes>
      <Route path="/" element={<MainWebsite />} />
      <Route path="/admin" element={<AdminPanel />} />
    </Routes>
  );
};

function App() {
  return (
    <ApolloProvider client={client}>
      <Provider store={store}>
        <Router>
          <AppContent />
        </Router>
      </Provider>
    </ApolloProvider>
  );
}

export default App;
