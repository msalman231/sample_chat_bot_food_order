import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { addToCart, removeFromCart, updateQuantity, clearCart } from '../store/cartSlice';
import { useQuery } from '@apollo/client';
import { GET_MENU_ITEMS } from '../apollo/queries';

// Chatbot message components
import MenuMessage from './chatbot/MenuMessage';
import CategoryMessage from './chatbot/CategoryMessage';
import CartMessage from './chatbot/CartMessage';
import AddonsMessage from './chatbot/AddonsMessage';
import AlternativesMessage from './chatbot/AlternativesMessage';
import ReceiptMessage from './chatbot/ReceiptMessage';
import MultiBulkMessage from './chatbot/MultiBulkMessage';
import BulkMenuMessage from './chatbot/BulkMenuMessage';

// AI Chatbot Service Configuration
const CHATBOT_SERVICE_URL = 'http://localhost:5000';
const SESSION_ID = 'restaurant_chat_' + Date.now();

const ChatBot = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'assistant',
      content: 'Hi! I\'m your AI-powered food ordering assistant. You can speak or type naturally to order food, browse categories, or manage your cart. Try saying "Show me pizzas", "I want pasta", or "What\'s on the menu?"!',
      timestamp: new Date()
    }
  ]);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  // const [isCheckoutMode, setIsCheckoutMode] = useState(false);
  const [hasAskedForAddons, setHasAskedForAddons] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [inputMode, setInputMode] = useState('voice'); // 'voice' or 'text'
  const [isTyping, setIsTyping] = useState(false);
  const [bulkQuantityMode, setBulkQuantityMode] = useState(null); // { quantity: number, itemType: string }
  const [multiCategoryBulkMode, setMultiCategoryBulkMode] = useState(null); // { categories: [{category: string, quantity: number}], currentIndex: number }
  const [aiServiceStatus, setAiServiceStatus] = useState('checking'); // 'connected', 'disconnected', 'checking'
  
  const dispatch = useDispatch();
  const { data: menuData } = useQuery(GET_MENU_ITEMS);
  const { items: cartItems } = useSelector((state) => state.cart);
  const recognitionRef = useRef(null);
  const chatContainerRef = useRef(null);
  const textInputRef = useRef(null);

  const clearAISession = async () => {
    try {
      await fetch(`${CHATBOT_SERVICE_URL}/clear_session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: SESSION_ID
        })
      });
    } catch (error) {
      console.error('Error clearing AI session:', error);
    }
  };
  
  // Check AI service health
  const checkAIServiceHealth = async () => {
    try {
      const response = await fetch(`${CHATBOT_SERVICE_URL}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (response.ok) {
        const healthData = await response.json();
        if (healthData.ai_status === 'rate_limited') {
          setAiServiceStatus('rate_limited');
        } else {
          setAiServiceStatus('connected');
        }
      } else {
        setAiServiceStatus('disconnected');
      }
    } catch (error) {
      setAiServiceStatus('disconnected');
    }
  };
  
  // Check AI service on component mount
  useEffect(() => {
    checkAIServiceHealth();
    
    // Check every 30 seconds
    const healthCheckInterval = setInterval(checkAIServiceHealth, 30000);
    
    return () => {
      clearInterval(healthCheckInterval);
      clearAISession();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Add function to handle clear chat
  const handleClearChat = async () => {
    try {
      // Call backend to clear session
      await fetch(`${CHATBOT_SERVICE_URL}/clear_session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: SESSION_ID
        })
      });
      
      // Clear frontend messages
      setMessages([
        {
          id: 1,
          type: 'assistant',
          content: 'Chat cleared! How can I help you today?',
          timestamp: new Date()
        }
      ]);
      
      // Reset states
      setBulkQuantityMode(null);
      setMultiCategoryBulkMode(null);
      setIsTyping(false);
      setIsProcessing(false);
      
    } catch (error) {
      console.error('Error clearing chat:', error);
      // Still clear frontend even if backend fails
      setMessages([
        {
          id: 1,
          type: 'assistant', 
          content: 'Chat cleared! How can I help you today?',
          timestamp: new Date()
        }
      ]);
    }
  };
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setTranscript('');
      };

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        setTranscript(finalTranscript || interimTranscript);

        if (finalTranscript) {
          handleUserInput(finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        addMessage('assistant', 'Sorry, I couldn\'t hear you clearly. Please try again.');
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);
  
  // Auto-focus text input when switching to text mode
  useEffect(() => {
    if (inputMode === 'text' && textInputRef.current) {
      setTimeout(() => textInputRef.current.focus(), 100);
    }
  }, [inputMode]);

  const addMessage = (type, content, menuItem = null, delay = 0, messageType = 'text') => {
    // If there's a delay and it's an assistant message, show typing first
    if (delay > 0 && type === 'assistant') {
      // Show typing animation
      setIsTyping(true);
      
      setTimeout(() => {
        setIsTyping(false);
        const newMessage = {
          id: Date.now(),
          type,
          content,
          menuItem,
          messageType,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, newMessage]);
      }, delay);
    } else {
      // Immediate message (no delay)
      const newMessage = {
        id: Date.now(),
        type,
        content,
        menuItem,
        messageType,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, newMessage]);
      
      // If this is an assistant message with no delay, make sure typing is off
      if (type === 'assistant') {
        setIsTyping(false);
      }
    }
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        addMessage('assistant', 'Voice recognition is not available on this device.');
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (textInput.trim() && !isProcessing) {
      handleUserInput(textInput.trim());
      setTextInput('');
    }
  };

  // Enhanced findMenuItemByName function with better fuzzy matching
  const findMenuItemByName = (itemName) => {
    if (!menuData?.menuItems) {
      console.warn('No menu data available');
      return null;
    }
    
    const searchTerm = itemName.toLowerCase().trim();
    console.log(`Frontend searching for: '${searchTerm}'`);
    console.log(`Available menu items: ${menuData.menuItems.slice(0, 5).map(item => item.name).join(', ')}...`);
    
    // 1. EXACT MATCH (highest priority)
    for (const item of menuData.menuItems) {
      if (item.name.toLowerCase() === searchTerm) {
        console.log(`EXACT match: '${searchTerm}' -> '${item.name}'`);
        return item;
      }
    }
    
    // 2. EXACT MATCH with common variations
    const searchVariations = [
      searchTerm,
      searchTerm.replace('salad', 'salads'),
      searchTerm.replace('salads', 'salad'),
      searchTerm + ' salad',
      searchTerm.replace(' salad', '').replace(' salads', '') + ' salad'
    ];
    
    for (const variation of searchVariations) {
      for (const item of menuData.menuItems) {
        if (item.name.toLowerCase() === variation.toLowerCase()) {
          console.log(`VARIATION match: '${searchTerm}' -> '${item.name}' (via '${variation}')`);
          return item;
        }
      }
    }
    
    // 3. STARTS WITH match
    for (const item of menuData.menuItems) {
      const itemNameLower = item.name.toLowerCase();
      if (itemNameLower.startsWith(searchTerm) || searchTerm.startsWith(itemNameLower)) {
        console.log(`STARTS WITH match: '${searchTerm}' -> '${item.name}'`);
        return item;
      }
    }
    
    // 4. CONTAINS match (search term in menu item name)
    const containsMatches = [];
    for (const item of menuData.menuItems) {
      const itemNameLower = item.name.toLowerCase();
      if (itemNameLower.includes(searchTerm)) {
        const score = searchTerm.length / itemNameLower.length;
        containsMatches.push({ item, score });
        console.log(`CONTAINS match: '${searchTerm}' in '${item.name}' (score: ${score.toFixed(2)})`);
      }
    }
    
    if (containsMatches.length > 0) {
      containsMatches.sort((a, b) => b.score - a.score);
      const bestMatch = containsMatches[0].item;
      console.log(`BEST CONTAINS match: '${searchTerm}' -> '${bestMatch.name}'`);
      return bestMatch;
    }
    
    // 5. REVERSE CONTAINS match (menu item name in search term)
    for (const item of menuData.menuItems) {
      const itemNameLower = item.name.toLowerCase();
      if (searchTerm.includes(itemNameLower)) {
        console.log(`REVERSE CONTAINS match: '${item.name}' in '${searchTerm}'`);
        return item;
      }
    }
    
    // 6. WORD-by-WORD matching
    const searchWords = searchTerm.split(' ').filter(word => word.length > 2);
    const wordMatches = [];
    
    for (const item of menuData.menuItems) {
      const itemWords = item.name.toLowerCase().split(' ');
      let matches = 0;
      
      for (const searchWord of searchWords) {
        for (const itemWord of itemWords) {
          if (searchWord.includes(itemWord) || itemWord.includes(searchWord)) {
            matches++;
            break;
          }
        }
      }
      
      if (matches > 0) {
        const score = matches / searchWords.length;
        wordMatches.push({ item, score, matches });
        console.log(`WORD match: '${searchTerm}' -> '${item.name}' (${matches}/${searchWords.length} words, score: ${score.toFixed(2)})`);
      }
    }
    
    if (wordMatches.length > 0) {
      wordMatches.sort((a, b) => b.matches - a.matches || b.score - a.score);
      const bestMatch = wordMatches[0].item;
      console.log(`BEST WORD match: '${searchTerm}' -> '${bestMatch.name}'`);
      return bestMatch;
    }
    
    // 7. ENHANCED SYNONYM matching
    const synonymMap = {
      // Salad variations
      'garden salad': ['Garden Salad', 'Fresh Garden Salad', 'Mixed Garden Salad', 'House Salad'],
      'garden salads': ['Garden Salad', 'Fresh Garden Salad'],
      'garden': ['Garden Salad', 'Fresh Garden Salad'],
      'greek salad': ['Greek Salad', 'Mediterranean Salad'],
      'caesar salad': ['Caesar Salad', 'Chicken Caesar Salad'],
      
      // Pizza variations  
      'margherita': ['Margherita Pizza'],
      'pepperoni': ['Pepperoni Pizza'],
      
      // Beverage variations
      'coke': ['Coca Cola', 'Coke'],
      'pepsi': ['Pepsi', 'Pepsi Cola'],
      'orange juice': ['Orange Juice', 'Fresh Orange Juice'],
      'apple juice': ['Apple Juice', 'Apple Juice Can'],
      'water': ['Water', 'Water Bottle'],
      
      // Fish variations
      'fish and chips': ['Fish and Chips', 'Fish & Chips'],
      'fish': ['Fish and Chips', 'Grilled Salmon'],
      'salmon': ['Grilled Salmon'],
      
      // Dessert variations
      'chocolate cake': ['Chocolate Cake', 'Rich Chocolate Cake'],
      'ice cream': ['Ice Cream', 'Vanilla Ice Cream'],
      'tiramisu': ['Tiramisu', 'Classic Tiramisu']
    };
    
    // Direct synonym lookup
    if (synonymMap[searchTerm]) {
      for (const synonymName of synonymMap[searchTerm]) {
        for (const item of menuData.menuItems) {
          if (item.name.toLowerCase() === synonymName.toLowerCase()) {
            console.log(`SYNONYM match: '${searchTerm}' -> '${item.name}' (direct synonym)`);
            return item;
          }
        }
      }
    }
    
    // Partial synonym matching
    for (const [synonymKey, synonymValues] of Object.entries(synonymMap)) {
      if (searchTerm.includes(synonymKey) || synonymKey.includes(searchTerm)) {
        for (const synonymName of synonymValues) {
          for (const item of menuData.menuItems) {
            if (item.name.toLowerCase() === synonymName.toLowerCase()) {
              console.log(`PARTIAL SYNONYM match: '${searchTerm}' -> '${item.name}' (via '${synonymKey}')`);
              return item;
            }
          }
        }
      }
    }
    
    console.log(`NO match found for: '${searchTerm}'`);
    return null;
  };

const handleUserInput = async (userText) => {
  setIsProcessing(true);
  
  // Add user message
  addMessage('user', userText);
  
  // Show typing animation immediately
  setIsTyping(true);
  
  try {
    // Prepare cart data for AI context
    const cartData = cartItems.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      total: item.totalPrice || (item.price * item.quantity)
    }));
    
    // Call AI chatbot service
    const response = await fetch(`${CHATBOT_SERVICE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userText,
        session_id: SESSION_ID,
        cart_items: cartData
      })
    });
    
    if (!response.ok) {
      throw new Error('Chatbot service unavailable');
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'AI response error');
    }
    
    // Stop typing animation before processing response
    setIsTyping(false);
    
    // Enhanced response parsing to handle mixed content
    let responseText = data.response;
    let actionData = data.action_data;
    
    // Check if response contains embedded JSON but action_data is missing/empty
    if (!actionData && responseText && typeof responseText === 'string' && responseText.includes('"action"')) {
      try {
        // Try to extract JSON from the response text
        const jsonMatch = responseText.match(/(?:json\s*)?\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/i);
        if (jsonMatch) {
          const jsonStr = jsonMatch[0].replace(/^json\s*/i, ''); // Remove 'json' prefix if present
          const extractedJson = JSON.parse(jsonStr);
          
          if (extractedJson.action) {
            actionData = extractedJson;
            // Clean the response text
            responseText = responseText
                .replace(jsonMatch[0], '')
                .replace(/updating now!?/gi, '')
                .replace(/please hold on\.?/gi, '')
                .replace(/json\s*/gi, '')
                .trim();
          }
        }
      } catch (parseError) {
        console.warn('Failed to extract JSON from response:', parseError);
        // Continue with original data
      }
    }
    
    // Ensure we have valid action data
    if (!actionData || typeof actionData !== 'object') {
      actionData = { action: 'text' };
    }
    
    // Process AI response and actions
    await processAIResponse(responseText, actionData);
    
    // Legacy fallback check for show_menu action in response text
    if (responseText && responseText.includes('"show_menu"') && !actionData.action) {
      console.log('Detected show_menu action in response text, triggering menu display');
      setTimeout(() => showMenuCategories(), 1000);
    }
    
  } catch (error) {
    console.error('AI Chatbot Error:', error);
    
    // Stop typing animation on error
    setIsTyping(false);
    
    // Fallback to basic responses if AI service is down
    handleFallbackResponse(userText);
  }
  
  setIsProcessing(false);
  setTranscript('');
};
  
const processAIResponse = async (response, actionData) => {
  // Handle cases where response might contain JSON mixed with text
  let cleanResponse = response;
  let parsedActionData = actionData;
  
  // Check if response contains embedded JSON that wasn't properly parsed
  if (typeof response === 'string' && response.includes('"action"') && response.includes('{') && response.includes('}')) {
    try {
      // Extract JSON from response text
      const jsonMatch = response.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
      if (jsonMatch) {
        const embeddedJson = JSON.parse(jsonMatch[0]);
        
        // If we found valid action data in the response, use it
        if (embeddedJson.action) {
          parsedActionData = embeddedJson;
          // Clean the response by removing the JSON part
          cleanResponse = response.replace(jsonMatch[0], '').trim();
          
          // If cleanResponse is empty or just whitespace, create a default message
          if (!cleanResponse || cleanResponse.length < 10) {
            cleanResponse = getDefaultResponseForAction(parsedActionData.action, parsedActionData);
          }
        }
      }
    } catch (jsonError) {
      console.warn('Failed to parse embedded JSON from response:', jsonError);
      // Continue with original response and actionData
    }
  }
  
  // Ensure we have valid action data
  if (!parsedActionData || typeof parsedActionData !== 'object') {
    parsedActionData = { action: 'text' };
  }
  
  const delay = parsedActionData.response_delay || 1500;
  
    // Handle different action types with enhanced item processing
    switch (parsedActionData.action) {
      case 'add':
        if (parsedActionData.items && parsedActionData.items.length > 0) {
          console.log('Processing ADD action:', parsedActionData.items);
          
          let addedItems = [];
          let notFoundItems = [];
          
          for (const item of parsedActionData.items) {
            console.log(`Looking for menu item: '${item.name}'`);
            
            // Enhanced menu item search with multiple fallbacks
            let menuItem = findMenuItemByName(item.name);
            
            // If not found, try variations
            if (!menuItem) {
              const variations = [
                item.name.toLowerCase(),
                item.name.toLowerCase().replace('salad', 'salads'),
                item.name.toLowerCase().replace('salads', 'salad'),
                item.name.toLowerCase() + ' salad',
                item.name.toLowerCase().replace(' salad', '')
              ];
              
              for (const variation of variations) {
                menuItem = findMenuItemByName(variation);
                if (menuItem) {
                  console.log(`Found via variation: '${item.name}' -> '${menuItem.name}' (using '${variation}')`);
                  break;
                }
              }
            }
            
            if (menuItem) {
              console.log(`Adding to cart: ${item.quantity || 1}x ${menuItem.name} at $${menuItem.price}`);
              
              dispatch(addToCart({
                id: menuItem.id,
                name: menuItem.name,
                price: menuItem.price,
                quantity: item.quantity || 1
              }));
              
              addedItems.push(`${item.quantity || 1} ${menuItem.name}`);
            } else {
              console.log(`Menu item not found: '${item.name}'`);
              notFoundItems.push(`${item.quantity || 1} ${item.name}`);
            }
          }
          
          // Create appropriate response based on results
          if (addedItems.length > 0 && notFoundItems.length === 0) {
            // All items found and added
            const successMessage = cleanResponse || `Great! I've added ${addedItems.join(' and ')} to your cart.`;
            addMessage('assistant', successMessage, null, delay);
          } else if (addedItems.length > 0 && notFoundItems.length > 0) {
            // Some items found, some not found
            const partialMessage = `I've added ${addedItems.join(' and ')} to your cart, but couldn't find ${notFoundItems.join(' and ')} on our menu.`;
            addMessage('assistant', partialMessage, null, delay);
          } else {
            // No items found
            const errorMessage = `I'm sorry, I couldn't find ${notFoundItems.join(' and ')} on our menu. Would you like to see our available items?`;
            addMessage('assistant', errorMessage, null, delay);
          }
        } else {
          addMessage('assistant', cleanResponse || "I'd be happy to add items to your cart. Could you please specify what you'd like?", null, delay);
        }
        break;
        
      case 'add_multiple':
        // Handle adding multiple different items to cart
        if (parsedActionData.items && parsedActionData.items.length > 0) {
          console.log('Processing ADD_MULTIPLE action:', parsedActionData.items);
          
          let addedItems = [];
          for (const item of parsedActionData.items) {
            const menuItem = findMenuItemByName(item.name);
            if (menuItem) {
              dispatch(addToCart({
                id: menuItem.id,
                name: menuItem.name,
                price: menuItem.price,
                quantity: item.quantity || 1
              }));
              addedItems.push(`${item.quantity || 1} ${menuItem.name}`);
              console.log(`Added: ${item.quantity || 1}x ${menuItem.name}`);
            } else {
              console.log(`Not found: ${item.name}`);
            }
          }
          
          // Use cleaned response or create a default one
          const multiItemResponse = cleanResponse || `Great! I've added ${addedItems.join(' and ')} to your cart.`;
          addMessage('assistant', multiItemResponse, null, delay);
        }
        break;
        
      case 'add_multiple_partial':
        // Handle adding multiple items where some weren't found
        if (parsedActionData.items && parsedActionData.items.length > 0) {
          let addedItems = [];
          for (const item of parsedActionData.items) {
            const menuItem = findMenuItemByName(item.name);
            if (menuItem) {
              dispatch(addToCart({
                id: menuItem.id,
                name: menuItem.name,
                price: menuItem.price,
                quantity: item.quantity || 1
              }));
              addedItems.push(`${item.quantity || 1} ${menuItem.name}`);
            }
          }
          
          const notFoundItems = parsedActionData.not_found_items || [];
          let partialResponse = cleanResponse;
          if (!partialResponse || partialResponse.length < 10) {
            partialResponse = `I've added ${addedItems.join(' and ')} to your cart.`;
            if (notFoundItems.length > 0) {
              partialResponse += ` However, I couldn't find ${notFoundItems.join(' and ')} on our menu. Would you like to see our available items?`;
            }
          }
          addMessage('assistant', partialResponse, null, delay);
        }
        break;
        
      case 'item_not_found':
        // Handle when requested items are not found
        const notFoundItems = parsedActionData.not_found_items || [];
        let notFoundResponse = cleanResponse;
        if (!notFoundResponse || notFoundResponse.length < 10) {
          if (notFoundItems.length > 0) {
            notFoundResponse = `I'm sorry, I couldn't find ${notFoundItems.join(' and ')} on our menu. Would you like me to show you our available items instead?`;
          } else {
            notFoundResponse = "I'm sorry, I couldn't find that item on our menu.";
          }
        }
        addMessage('assistant', notFoundResponse, null, delay);
        break;
        
      case 'remove':
        if (parsedActionData.items && parsedActionData.items.length > 0) {
          for (const item of parsedActionData.items) {
            const cartItem = cartItems.find(ci => ci.name.toLowerCase().includes(item.name.toLowerCase()));
            if (cartItem) {
              if (item.quantity && item.quantity < cartItem.quantity) {
                dispatch(updateQuantity({ id: cartItem.id, quantity: cartItem.quantity - item.quantity }));
              } else {
                dispatch(removeFromCart(cartItem.id));
              }
            }
          }
        }
        addMessage('assistant', cleanResponse, null, delay);
        break;
        
      case 'remove_all':
        // Handle remove all of a specific item type
        if (parsedActionData.target_item) {
          const targetItem = parsedActionData.target_item;
          // Find all cart items that match the target item with more precise matching
          const itemsToRemove = cartItems.filter(cartItem => {
            const cartItemName = cartItem.name.toLowerCase();
            const targetItemName = targetItem.toLowerCase();
            
            // Exact match or partial match in either direction
            return cartItemName === targetItemName || 
                   cartItemName.includes(targetItemName) || 
                   targetItemName.includes(cartItemName) ||
                   // Word boundary matching for better accuracy
                   cartItemName.split(' ').some(word => word.includes(targetItemName) || targetItemName.includes(word));
          });
          
          if (itemsToRemove.length > 0) {
            // Remove all matching items
            itemsToRemove.forEach(item => {
              dispatch(removeFromCart(item.id));
            });
            
            const totalQuantity = itemsToRemove.reduce((sum, item) => sum + item.quantity, 0);
            const itemNames = [...new Set(itemsToRemove.map(item => item.name))].join(', ');
            
            const removeAllResponse = cleanResponse || `I've removed all ${itemNames} from your cart (${totalQuantity} items total). Anything else you'd like to order?`;
            addMessage('assistant', removeAllResponse, null, delay);
          } else {
            const noItemsResponse = cleanResponse || `I couldn't find any ${targetItem} items in your cart.`;
            addMessage('assistant', noItemsResponse, null, delay);
          }
        }
        break;

      case 'update':
        // Handle quantity updates (increase/decrease)
        if (parsedActionData.operation) {
          const operation = parsedActionData.operation; // 'increase' or 'decrease'
          const targetItem = parsedActionData.target_item || parsedActionData.target;
          const quantity = parsedActionData.quantity || 1;
          
          // Find the cart item to update
          const cartItem = cartItems.find(ci => 
            ci.name.toLowerCase().includes(targetItem.toLowerCase()) ||
            targetItem.toLowerCase().includes(ci.name.toLowerCase())
          );
          
          if (cartItem) {
            if (operation === 'increase') {
              dispatch(updateQuantity({ id: cartItem.id, quantity: cartItem.quantity + quantity }));
            } else if (operation === 'decrease') {
              const newQuantity = Math.max(1, cartItem.quantity - quantity);
              dispatch(updateQuantity({ id: cartItem.id, quantity: newQuantity }));
            }
          }
        }
        addMessage('assistant', cleanResponse, null, delay);
        break;
        
      case 'show_menu':
        addMessage('assistant', cleanResponse, null, delay);
        setTimeout(() => {
          console.log('Showing menu categories, menuData:', menuData);
          showMenuCategories();
        }, delay + 500);
        break;
        
      case 'show_category':
        if (parsedActionData.category) {
          addMessage('assistant', cleanResponse, null, delay);
          setTimeout(() => showCategoryItems(parsedActionData.category), delay + 500);
        } else {
          addMessage('assistant', cleanResponse, null, delay);
        }
        break;
        
      case 'show_cart':
        addMessage('assistant', cleanResponse, null, delay);
        setTimeout(() => showCartContents(), delay + 500);
        break;
        
      case 'clear_cart':
        dispatch(clearCart());
        addMessage('assistant', cleanResponse, null, delay);
        break;
        
      case 'clear_chat':
        // Handle clear chat action from API
        await handleClearChat();
        break;
        
      case 'place_order':
        // Generate receipt and clear cart
        const orderTotal = parsedActionData.order_total || cartItems.reduce((total, item) => total + (item.totalPrice || item.price * item.quantity), 0);
        const orderId = parsedActionData.order_id || `ORD-${Date.now()}`;
        
        const receiptData = {
          orderId: orderId,
          items: cartItems.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.totalPrice || (item.price * item.quantity)
          })),
          subtotal: orderTotal,
          tax: orderTotal * 0.08, // 8% tax
          total: orderTotal * 1.08,
          orderTime: new Date().toLocaleString(),
          estimatedTime: '15-20 minutes'
        };
        
        // Show receipt first
        addMessage('assistant', receiptData, null, delay, 'receipt');
        
        // Clear cart after showing receipt
        setTimeout(() => {
          dispatch(clearCart());
          setBulkQuantityMode(null);
        }, delay + 1000);
        break;
        
      case 'multi_category_bulk':
        if (parsedActionData.multi_categories && parsedActionData.multi_categories.length > 0) {
          // Set up multi-category bulk mode
          setMultiCategoryBulkMode({
            categories: parsedActionData.multi_categories,
            currentIndex: 0
          });
          
          // Show the first category
          const firstCategory = parsedActionData.multi_categories[0];
          const multiCategoryData = {
            categories: parsedActionData.multi_categories,
            currentCategory: firstCategory.category,
            currentQuantity: firstCategory.quantity,
            currentIndex: 0,
            totalCategories: parsedActionData.multi_categories.length,
            message: cleanResponse
          };
          
          addMessage('assistant', multiCategoryData, null, delay, 'multi-bulk');
        } else {
          addMessage('assistant', cleanResponse, null, delay);
        }
        break;
        
      case 'bulk_menu':
        if (parsedActionData.bulk_quantity) {
          setBulkQuantityMode({
            quantity: parsedActionData.bulk_quantity,
            itemType: parsedActionData.category || 'items',
            category: parsedActionData.category || 'all'
          });
          
          const bulkMenuData = {
            requestedQuantity: parsedActionData.bulk_quantity,
            itemType: parsedActionData.category || 'items',
            category: parsedActionData.category || 'all',
            message: cleanResponse
          };
          
          addMessage('assistant', bulkMenuData, null, delay, 'bulk-menu');
        } else {
          addMessage('assistant', cleanResponse, null, delay);
        }
        break;
        
      default:
        // Regular text response - handle any remaining JSON in response
        let finalResponse = cleanResponse;
        if (typeof finalResponse === 'string' && finalResponse.includes('"action"')) {
          // Remove any remaining JSON artifacts
          finalResponse = finalResponse.replace(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '').trim();
          
          // If response is empty after cleaning, provide a default
          if (!finalResponse || finalResponse.length < 5) {
            finalResponse = "I've processed your request. How else can I help you today?";
          }
        }
        addMessage('assistant', finalResponse, null, delay);
        break;
    }
  };

// Helper function to generate default responses for actions
const getDefaultResponseForAction = (action, actionData) => {
  switch (action) {
    case 'add':
      if (actionData.items && actionData.items.length > 0) {
        const itemNames = actionData.items.map(item => `${item.quantity || 1} ${item.name}`).join(' and ');
        return `Great! I've added ${itemNames} to your cart.`;
      }
      return "I've added the item to your cart.";
      
    case 'add_multiple':
      return "I've added multiple items to your cart.";
      
    case 'remove':
      return "I've removed the item from your cart.";
      
    case 'show_menu':
      return "Here's our menu! Let me show you all our categories.";
      
    case 'show_category':
      if (actionData.category) {
        return `Here are our ${actionData.category} options:`;
      }
      return "Here are the items in this category:";
      
    case 'show_cart':
      return "Here's your current cart:";
      
    case 'clear_cart':
      return "I've cleared your cart.";
      
    default:
      return "I've processed your request. How can I help you further?";
  }
};

  const handleFallbackResponse = (userText) => {
    const lowerText = userText.toLowerCase();
    
    // Check for quantity increase/decrease requests
    if (lowerText.includes('increase') || lowerText.includes('decrease') || lowerText.includes('add more') || lowerText.includes('reduce')) {
      handleQuantityChangeRequest(userText);
      return;
    }
    
    // Check for removal requests
    if (lowerText.includes('remove') || lowerText.includes('delete')) {
      handleRemovalRequest(userText);
      return;
    }
    
    // Basic fallback responses when AI is unavailable
    if (lowerText.includes('menu')) {
      addMessage('assistant', 'Here\'s our complete menu! Let me show you all our delicious categories.', null, 1500);
      setTimeout(() => showMenuCategories(), 2000);
    } else if (lowerText.includes('cart')) {
      addMessage('assistant', 'Let me show you your current cart contents.', null, 1000);
      setTimeout(() => showCartContents(), 1500);
    } else if (lowerText.includes('clear')) {
      dispatch(clearCart());
      addMessage('assistant', 'I\'ve cleared your cart. Ready for a new order!');
    } else if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('i\'m ') || lowerText.includes('im ')) {
      addMessage('assistant', 'Hello! Your cart is currently empty. How can I assist you today? Would you like to browse our menu categories?', null, 1500);
      setTimeout(() => {
        console.log('Fallback greeting - showing menu categories');
        showMenuCategories();
      }, 2000);
    } else {
      addMessage('assistant', 'I\'m sorry, our AI assistant is temporarily unavailable. Let me show you our menu so you can browse our options.', null, 1500);
      setTimeout(() => showMenuCategories(), 2000);
    }
  };

  const extractQuantity = (voiceText) => {
    // Enhanced quantity detection with better patterns
    const quantityPatterns = [
      // Explicit quantity phrases
      /\b(\d+)\s*(pieces?|items?|orders?|servings?)?\b/gi,
      // Number words
      /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/gi,
      // Special quantity phrases
      /\b(a couple|couple)\b/gi, // = 2
      /\b(a few|few)\b/gi, // = 3
      /\b(several)\b/gi, // = 4
      /\b(half dozen)\b/gi, // = 6
      /\b(dozen)\b/gi // = 12
    ];
    
    const numberWords = {
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
      'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
      'couple': 2, 'few': 3, 'several': 4, 'half dozen': 6, 'dozen': 12
    };
    
    // Look for explicit quantities
    for (const pattern of quantityPatterns) {
      const matches = voiceText.match(pattern);
      if (matches) {
        for (const match of matches) {
          const lower = match.toLowerCase().trim();
          
          // Check for number words first
          if (numberWords[lower]) {
            return numberWords[lower];
          }
          
          // Extract just the number part for digit patterns
          const numberMatch = match.match(/\d+/);
          if (numberMatch) {
            const num = parseInt(numberMatch[0]);
            if (!isNaN(num) && num > 0 && num <= 50) { // Reasonable limit
              return num;
            }
          }
        }
      }
    }
    
    return 1; // Default quantity
  };
  
  const handleCheckoutRequest = () => {
    // Check if cart has items
    const cartItems = JSON.parse(localStorage.getItem('cart') || '[]');
    
    if (cartItems.length === 0) {
      addMessage('assistant', 'Your cart is empty! Tell me what you\'d like to order first.');
      return;
    }
    
    if (!hasAskedForAddons) {
      setIsCheckoutMode(true);
      setHasAskedForAddons(true);
      addMessage('assistant', 'Before we proceed to checkout, would you like to add any extras like drinks, sides, or condiments? Say "yes" to see addon options or "no" to proceed directly to checkout.');
    } else {
      addMessage('assistant', 'Perfect! Your order is ready in your cart. You can review it and proceed to checkout whenever you\'re ready. Thanks for using voice ordering!');
    }
  };
  
  const suggestAddons = () => {
    const addonItems = menuData?.menuItems?.filter(item => item.isAddon) || [];
    const categories = [...new Set(addonItems.map(item => item.category))];
    
    const addonsData = {
      categories: categories.map(category => {
        const categoryItems = addonItems.filter(item => item.category === category);
        return {
          name: category,
          items: categoryItems
        };
      })
    };
    
    addMessage('assistant', addonsData, null, 2000, 'addons');
  };
  
  const handleUnmatchedInput = (voiceText) => {
    const lowerText = voiceText.toLowerCase();
    
    // Try to extract intent even if no exact match
    const orderKeywords = ['want', 'need', 'get', 'order', 'add', 'give', 'bring'];
    const hasOrderIntent = orderKeywords.some(keyword => lowerText.includes(keyword));
    
    if (hasOrderIntent) {
      // They want to order something but we couldn't match it
      const words = voiceText.toLowerCase().split(' ').filter(word => word.length > 2);
      const partialMatches = menuData?.menuItems?.filter(item => 
        words.some(word => 
          item.name.toLowerCase().includes(word) || 
          item.description.toLowerCase().includes(word) ||
          item.category.toLowerCase().includes(word)
        )
      ) || [];
      
      if (partialMatches.length > 0) {
        const suggestions = partialMatches.slice(0, 4).map(item => `${item.name} ($${item.price})`).join(', ');
        addMessage('assistant', `I think I understand what you\'re looking for! Here are some similar items: ${suggestions}. Which one sounds good to you?`);
      } else {
        addMessage('assistant', `I want to help you find what you're craving! Could you try describing it differently? For example, say "pizza", "pasta", "salad", or ask "what\'s on the menu?" to see all our options.`);
      }
    } else {
      // General conversation
      const responses = [
        'I\'m here to help you order food! What would you like to eat today?',
        'Tell me what you\'re in the mood for and I\'ll find it on our menu!',
        'What delicious food can I help you order?',
        'I\'d love to help you with your food order. What sounds good to you?'
      ];
      addMessage('assistant', responses[Math.floor(Math.random() * responses.length)]);
    }
  };
  
  const showCartContents = () => {
    if (cartItems.length === 0) {
      addMessage('assistant', 'Your cart is currently empty. What would you like to order?');
      return;
    }
    
    let total = 0;
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    
    const cartData = {
      items: cartItems.map((item, index) => {
        const itemTotal = item.totalPrice || (item.price * item.quantity);
        total += itemTotal;
        return {
          index: index + 1,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: itemTotal,
          id: item.id
        };
      }),
      total: total,
      totalItems: totalItems,
      summary: `${totalItems} item${totalItems !== 1 ? 's' : ''} • Total: $${total.toFixed(2)}`
    };
    
    addMessage('assistant', cartData, null, 1500, 'cart');
  };
  
  const handleRemovalRequest = (userText) => {
    if (cartItems.length === 0) {
      addMessage('assistant', 'Your cart is empty, so there\'s nothing to remove!');
      return;
    }
    
    const lowerText = userText.toLowerCase();
    
    // Check for "remove all" or "clear cart"
    if (lowerText.includes('all') || lowerText.includes('everything') || lowerText.includes('clear')) {
      // Check if they want to remove all of a specific item type
      const itemToRemoveAll = findItemTypeToRemoveAll(userText);
      if (itemToRemoveAll) {
        // Remove all instances of this specific item
        const itemsToRemove = cartItems.filter(cartItem => 
          cartItem.name.toLowerCase().includes(itemToRemoveAll.toLowerCase()) ||
          itemToRemoveAll.toLowerCase().includes(cartItem.name.toLowerCase())
        );
        
        if (itemsToRemove.length > 0) {
          // Remove all matching items
          itemsToRemove.forEach(item => {
            dispatch(removeFromCart(item.id));
          });
          
          const totalQuantity = itemsToRemove.reduce((sum, item) => sum + item.quantity, 0);
          const itemNames = [...new Set(itemsToRemove.map(item => item.name))].join(', ');
          
          addMessage('assistant', `I\'ve removed all ${itemNames} from your cart (${totalQuantity} items total). Anything else you\'d like to order?`);
        } else {
          addMessage('assistant', `I couldn\'t find any ${itemToRemoveAll} items in your cart. Here\'s what you currently have:`);
          setTimeout(() => showCartContents(), 1000);
        }
        return;
      }
      
      // Remove everything
      dispatch(clearCart());
      addMessage('assistant', 'I\'ve cleared your entire cart. What would you like to order?');
      return;
    }
    
    // Find item to remove based on text
    const matchedCartItem = findCartItemToRemove(userText);
    
    if (matchedCartItem) {
      // Extract quantity to remove
      const quantity = extractQuantity(userText);
      
      if (quantity >= matchedCartItem.quantity) {
        // Remove entire item
        dispatch(removeFromCart(matchedCartItem.id));
        addMessage('assistant', `I\'ve removed ${matchedCartItem.name} from your cart. Anything else you\'d like to order?`);
      } else {
        // Reduce quantity
        const newQuantity = matchedCartItem.quantity - quantity;
        dispatch(updateQuantity({ id: matchedCartItem.id, quantity: newQuantity }));
        addMessage('assistant', `I\'ve removed ${quantity} ${matchedCartItem.name}${quantity > 1 ? 's' : ''} from your cart. You now have ${newQuantity} remaining.`);
      }
    } else {
      // Show cart contents and ask for clarification
      const cartListData = {
        items: cartItems.map((item, index) => ({
          index: index + 1,
          name: item.name,
          quantity: item.quantity,
          id: item.id
        })),
        isRemovalHelp: true
      };
      addMessage('assistant', "I couldn't find that item to remove. Here's what's in your cart:", null, 1000);
      setTimeout(() => {
        addMessage('assistant', cartListData, null, 1000, 'cart');
      }, 1500);
    }
  };
  
  const findCartItemToRemove = (userText) => {
    const lowerText = userText.toLowerCase();
    
    // Try to match cart item by name
    for (const cartItem of cartItems) {
      const itemName = cartItem.name.toLowerCase();
      if (lowerText.includes(itemName) || itemName.includes(lowerText.replace(/remove|delete|take out|cancel/gi, '').trim())) {
        return cartItem;
      }
    }
    
    // Try word-by-word matching
    const words = lowerText.split(' ').filter(word => 
      word.length > 2 && !['remove', 'delete', 'take', 'out', 'cancel', 'from', 'cart'].includes(word)
    );
    
    for (const cartItem of cartItems) {
      const itemWords = cartItem.name.toLowerCase().split(' ');
      if (words.some(word => itemWords.some(itemWord => itemWord.includes(word) || word.includes(itemWord)))) {
        return cartItem;
      }
    }
    
    return null;
  };
  
  const findItemTypeToRemoveAll = (userText) => {
    const lowerText = userText.toLowerCase();
    
    // Remove common removal words to get the item type
    const cleanedText = lowerText
      .replace(/remove|delete|take|out|cancel|all|from|cart|the/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Try to match with cart items
    for (const cartItem of cartItems) {
      const itemName = cartItem.name.toLowerCase();
      const itemWords = itemName.split(' ');
      
      // Check if cleaned text matches any part of item name
      if (cleanedText.includes(itemName) || itemName.includes(cleanedText)) {
        return cartItem.name;
      }
      
      // Check individual words
      const cleanedWords = cleanedText.split(' ').filter(word => word.length > 2);
      for (const word of cleanedWords) {
        if (itemWords.some(itemWord => itemWord.includes(word) || word.includes(itemWord))) {
          return cartItem.name;
        }
      }
    }
    
    // Try to match with category names or common food types
    const foodTypes = ['pizza', 'pizzas', 'burger', 'burgers', 'salad', 'salads', 'pasta', 'pastas', 'drink', 'drinks', 'beverage', 'beverages'];
    for (const foodType of foodTypes) {
      if (cleanedText.includes(foodType)) {
        return foodType;
      }
    }
    
    return null;
  };
  
  const handleQuantityChangeRequest = (userText) => {
    if (cartItems.length === 0) {
      addMessage('assistant', 'Your cart is empty, so there\'s nothing to modify!');
      return;
    }
    
    const lowerText = userText.toLowerCase();
    
    // Determine if it's increase or decrease
    const isIncrease = lowerText.includes('increase') || lowerText.includes('add more') || lowerText.includes('more');
    const isDecrease = lowerText.includes('decrease') || lowerText.includes('reduce') || lowerText.includes('less');
    
    // Find the item to modify
    const itemToModify = findCartItemToModify(userText);
    
    if (!itemToModify) {
      addMessage('assistant', 'I couldn\'t find that item in your cart. Here\'s what you currently have:');
      setTimeout(() => showCartContents(), 1000);
      return;
    }
    
    // Extract quantity to change (default to 1)
    const quantityChange = extractQuantityChange(userText);
    
    if (isIncrease) {
      // Increase quantity
      const newQuantity = itemToModify.quantity + quantityChange;
      dispatch(updateQuantity({ id: itemToModify.id, quantity: newQuantity }));
      
      const changeText = quantityChange > 1 ? `${quantityChange}` : '';
      addMessage('assistant', `I\'ve increased ${itemToModify.name} by ${quantityChange}. You now have ${newQuantity} ${itemToModify.name}${newQuantity > 1 ? 's' : ''} in your cart.`);
      
    } else if (isDecrease) {
      // Decrease quantity
      const newQuantity = Math.max(0, itemToModify.quantity - quantityChange);
      
      if (newQuantity === 0) {
        // Remove item completely
        dispatch(removeFromCart(itemToModify.id));
        addMessage('assistant', `I\'ve removed all ${itemToModify.name} from your cart since the quantity would be zero.`);
      } else {
        // Update quantity
        dispatch(updateQuantity({ id: itemToModify.id, quantity: newQuantity }));
        addMessage('assistant', `I\'ve decreased ${itemToModify.name} by ${quantityChange}. You now have ${newQuantity} ${itemToModify.name}${newQuantity > 1 ? 's' : ''} in your cart.`);
      }
    } else {
      // Generic quantity change detection
      addMessage('assistant', 'I understand you want to modify the quantity. Please specify if you want to "increase" or "decrease" the amount.');
    }
  };
  
  const findCartItemToModify = (userText) => {
    const lowerText = userText.toLowerCase();
    
    // Remove quantity change words to get the item name
    const cleanedText = lowerText
      .replace(/increase|decrease|add\s+more|reduce|more|less|quantity|of|the|by/gi, '')
      .replace(/\d+/g, '') // Remove numbers
      .replace(/\s+/g, ' ')
      .trim();
    
    // Try to match cart item by name
    for (const cartItem of cartItems) {
      const itemName = cartItem.name.toLowerCase();
      if (cleanedText.includes(itemName) || itemName.includes(cleanedText)) {
        return cartItem;
      }
    }
    
    // Try word-by-word matching
    const words = cleanedText.split(' ').filter(word => 
      word.length > 2 && !['increase', 'decrease', 'more', 'less', 'quantity', 'from', 'cart'].includes(word)
    );
    
    for (const cartItem of cartItems) {
      const itemWords = cartItem.name.toLowerCase().split(' ');
      if (words.some(word => itemWords.some(itemWord => itemWord.includes(word) || word.includes(itemWord)))) {
        return cartItem;
      }
    }
    
    return null;
  };
  
  const extractQuantityChange = (userText) => {
    // Look for quantity change patterns
    const quantityPatterns = [
      /\b(?:by\s+)?(\d+)\b/gi,
      /\b(?:by\s+)?(one|two|three|four|five|six|seven|eight|nine|ten)\b/gi,
    ];
    
    const numberWords = {
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
    };
    
    for (const pattern of quantityPatterns) {
      const matches = userText.match(pattern);
      if (matches) {
        for (const match of matches) {
          const lower = match.toLowerCase().replace('by ', '').trim();
          
          // Check for number words
          if (numberWords[lower]) {
            return numberWords[lower];
          }
          
          // Extract number
          const numberMatch = match.match(/\d+/);
          if (numberMatch) {
            const num = parseInt(numberMatch[0]);
            if (!isNaN(num) && num > 0 && num <= 20) {
              return num;
            }
          }
        }
      }
    }
    
    return 1; // Default quantity change
  };
  
  const handleUnavailableItem = (unavailableItem, alternativeItems) => {
    // Create detailed explanation about the unavailable item
    let response = `I understand you're interested in our **${unavailableItem.name}**! `;
    response += `Unfortunately, this item is currently unavailable. `;
    
    // Add explanation about the item
    if (unavailableItem.description) {
      response += `This is our ${unavailableItem.description.toLowerCase()}. `;
    }
    
    // Explain why it might be unavailable (general reasons)
    const unavailableReasons = [
      "We're currently out of some key ingredients for this dish.",
      "Our chef is preparing a fresh batch and it's not ready yet.",
      "This item is temporarily unavailable due to high demand.",
      "We're restocking the ingredients needed for this specialty."
    ];
    response += unavailableReasons[Math.floor(Math.random() * unavailableReasons.length)];
    
    // Send the explanation first
    addMessage('assistant', response, null, 3000);
    
    // Filter available alternatives
    const availableAlternatives = alternativeItems.filter(item => item.available);
    
    if (availableAlternatives.length > 0) {
      // Show alternatives in rich UI format
      setTimeout(() => {
        const alternativesData = {
          title: "Delicious Alternatives Available",
          unavailableItem: unavailableItem.name,
          items: availableAlternatives
        };
        addMessage('assistant', alternativesData, null, 2000, 'alternatives');
      }, 3500);
    } else {
      // Suggest items from same category
      const sameCategory = menuData?.menuItems?.filter(item => 
        item.category === unavailableItem.category && item.available && item.id !== unavailableItem.id
      ) || [];
      
      if (sameCategory.length > 0) {
        setTimeout(() => {
          const categoryAlternativesData = {
            title: `Other Amazing ${unavailableItem.category} Options`,
            unavailableItem: unavailableItem.name,
            category: unavailableItem.category,
            items: sameCategory.slice(0, 3)
          };
          addMessage('assistant', categoryAlternativesData, null, 2000, 'alternatives');
        }, 3500);
      } else {
        setTimeout(() => {
          addMessage('assistant', "Let me know what other delicious items from our menu sound good to you! I'm here to help you find the perfect meal.", null, 1000);
        }, 3500);
      }
    }
  };
  
  const detectCategoryRequest = (userText) => {
    const lowerText = userText.toLowerCase();
    
    // Get all available categories from menu
    const categories = [...new Set(menuData?.menuItems?.filter(item => !item.isAddon).map(item => item.category.toLowerCase()) || [])];
    
    // Category keywords and variations
    const categoryMappings = {
      'pizza': ['pizza', 'pizzas'],
      'pasta': ['pasta', 'pastas', 'noodles', 'spaghetti', 'linguine', 'fettuccine'],
      'salads': ['salad', 'salads', 'greens'],
      'seafood': ['seafood', 'fish', 'salmon', 'shrimp'],
      'desserts': ['dessert', 'desserts', 'sweet', 'sweets', 'cake', 'ice cream'],
      'appetizers': ['appetizer', 'appetizers', 'starter', 'starters', 'apps'],
      'beverages': ['beverage', 'beverages', 'drink', 'drinks', 'juice', 'water'],
      'sides': ['side', 'sides'],
      'condiments': ['condiment', 'condiments', 'sauce', 'sauces'],
      'extras': ['extra', 'extras', 'addon', 'addons', 'add-on', 'add-ons']
    };
    
    // Check if user is asking for a general category
    const orderKeywords = ['want', 'get', 'order', 'add', 'show', 'see', 'have', 'like', 'give', 'bring'];
    const hasOrderIntent = orderKeywords.some(keyword => lowerText.includes(keyword));
    
    if (hasOrderIntent) {
      // Look for category mentions
      for (const [category, variations] of Object.entries(categoryMappings)) {
        if (variations.some(variation => {
          // Check if the variation appears as a standalone word or with basic plurals
          const regex = new RegExp(`\\b${variation}s?\\b`, 'i');
          return regex.test(lowerText);
        })) {
          // Check if this category exists in our menu
          const actualCategory = categories.find(cat => 
            cat.toLowerCase() === category || 
            categoryMappings[category]?.some(v => cat.toLowerCase().includes(v))
          );
          if (actualCategory) {
            return actualCategory;
          }
          // Return the mapped category if it exists in menu
          const foundCategory = categories.find(cat => cat.toLowerCase() === category);
          if (foundCategory) {
            return foundCategory;
          }
        }
      }
    }
    
    return null;
  };
  
  const showCategoryItems = (categoryName) => {
    const categoryItems = menuData?.menuItems?.filter(item => 
      item.category.toLowerCase() === categoryName.toLowerCase() && 
      !item.isAddon &&
      item.available
    ) || [];
    
    if (categoryItems.length === 0) {
      addMessage('assistant', `Sorry, we don\'t have any available ${categoryName.toLowerCase()} items right now. What else would you like to try?`, null, 2000);
      return;
    }
    
    const categoryData = {
      categoryName: categoryName,
      items: categoryItems
    };
    
    addMessage('assistant', categoryData, null, 3000, 'category');
  };
  
  const showMenuCategories = () => {
    const categories = [...new Set(menuData?.menuItems?.filter(item => !item.isAddon).map(item => item.category) || [])];
    
    const menuData_formatted = {
      categories: categories.map(category => {
        const categoryItems = menuData?.menuItems?.filter(item => 
          item.category === category && !item.isAddon && item.available
        ) || [];
        
        return {
          name: category,
          itemCount: categoryItems.length,
          sampleItems: categoryItems.slice(0, 2),
          hasMore: categoryItems.length > 2,
          moreCount: categoryItems.length - 2
        };
      })
    };
    
    addMessage('assistant', menuData_formatted, null, 3000, 'menu');
  };

  const findMenuItems = (voiceText) => {
    if (!menuData?.menuItems) return [];
    
    const searchText = voiceText.toLowerCase().trim();
    
    // Clean up common voice recognition errors and variations
    const cleanedText = searchText
      .replace(/\bi want\b|\bi'd like\b|\bcan i have\b|\bcan i get\b|\border\b|\bget me\b|\badd\b/g, '')
      .replace(/\bplease\b|\bthank you\b|\bthanks\b/g, '')
      .replace(/\ba\b|\ban\b|\bthe\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Check for exact item name matches first (for direct add functionality)
    const exactMatches = menuData.menuItems.filter(item => {
      const itemName = item.name.toLowerCase();
      return itemName === cleanedText || 
             itemName === searchText ||
             cleanedText.includes(itemName) ||
             searchText.includes(itemName);
    });
    
    // If we have exact matches, return them with high score
    if (exactMatches.length > 0) {
      return exactMatches.map(item => ({ ...item, score: 1000, isExactMatch: true }));
    }
    
    const words = cleanedText.split(' ').filter(word => word.length > 2);
    
    // Common food synonyms and variations
    const synonyms = {
      'fries': ['french fries', 'potato fries', 'chips'],
      'burger': ['hamburger', 'cheeseburger', 'sandwich'],
      'soda': ['drink', 'beverage', 'soft drink', 'coke', 'pepsi'],
      'pizza': ['pie'],
      'chicken': ['chick', 'poultry'],
      'beef': ['meat', 'steak'],
      'pasta': ['spaghetti', 'noodles', 'linguine', 'penne'],
      'salad': ['greens', 'lettuce'],
      'soup': ['broth'],
      'dessert': ['sweet', 'cake', 'ice cream', 'pudding']
    };
    
    return menuData.menuItems
      .map(item => {
        const itemName = item.name.toLowerCase();
        const itemDescription = item.description?.toLowerCase() || '';
        const itemCategory = item.category?.toLowerCase() || '';
        
        let score = 0;
        
        // Exact name match gets highest score
        if (itemName === cleanedText) score += 100;
        
        // Name contains cleaned search text
        if (itemName.includes(cleanedText)) score += 80;
        
        // Original search text in name
        if (itemName.includes(searchText)) score += 70;
        
        // Category match
        if (itemCategory.includes(cleanedText)) score += 40;
        
        // Individual word matches in name
        words.forEach(word => {
          if (itemName.includes(word)) score += 30;
          if (itemDescription.includes(word)) score += 15;
          if (itemCategory.includes(word)) score += 20;
          
          // Check synonyms
          Object.entries(synonyms).forEach(([key, syns]) => {
            if (word === key || syns.includes(word)) {
              if (itemName.includes(key) || syns.some(syn => itemName.includes(syn))) {
                score += 25;
              }
            }
          });
        });
        
        // Partial name matching (for fuzzy search)
        const nameWords = itemName.split(' ');
        nameWords.forEach(nameWord => {
          words.forEach(searchWord => {
            if (nameWord.startsWith(searchWord) || searchWord.startsWith(nameWord)) {
              score += 10;
            }
          });
        });
        
        return { ...item, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
  };

  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const handleCategoryClick = (categoryName) => {
    // Add user message showing they clicked the category
    addMessage('user', `Show me ${categoryName}`);
    
    // Show the category items
    setTimeout(() => {
      showCategoryItems(categoryName);
    }, 500);
  };
  
  const handleItemClick = (item) => {
    // Check availability
    if (!item.available) {
      addMessage('user', `Add ${item.name}`);
      setTimeout(() => {
        handleUnavailableItem(item, []);
      }, 500);
      return;
    }
    
    // Determine quantity based on bulk mode
    const quantity = bulkQuantityMode ? bulkQuantityMode.quantity : 1;
    const quantityText = quantity > 1 ? ` (${quantity})` : '';
    
    // Add user message
    addMessage('user', `Add ${item.name}${quantityText}`);
    
    // Add item to cart
    setTimeout(() => {
      dispatch(addToCart({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: quantity
      }));
      
      let response;
      if (bulkQuantityMode) {
        const totalPrice = (item.price * quantity).toFixed(2);
        response = `Excellent! I've added ${quantity} ${item.name} (${quantity} × $${item.price} = $${totalPrice}) to your cart. `;
        
        if (bulkQuantityMode.category === 'all') {
          response += `You can continue selecting more items from the menu, each will be added with quantity ${quantity}.`;
        } else {
          response += `Continue selecting from the ${bulkQuantityMode.category} menu - each item will be added with quantity ${quantity}.`;
        }
      } else {
        response = `Perfect! I've added ${item.name} ($${item.price}) to your cart. Would you like to add anything else?`;
      }
      
      addMessage('assistant', response, item, 1000);
    }, 500);
  };
  
  const handleMultiCategoryItemClick = (item, contentData) => {
    // Check availability
    if (!item.available) {
      addMessage('user', `Add ${item.name}`);
      setTimeout(() => {
        handleUnavailableItem(item, []);
      }, 500);
      return;
    }
    
    const quantity = contentData.currentQuantity;
    const quantityText = quantity > 1 ? ` (${quantity})` : '';
    
    // Add user message
    addMessage('user', `Add ${item.name}${quantityText}`);
    
    // Add item to cart
    setTimeout(() => {
      dispatch(addToCart({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: quantity
      }));
      
      const totalPrice = (item.price * quantity).toFixed(2);
      let response = `Great! I've added ${quantity} ${item.name} (${quantity} × $${item.price} = $${totalPrice}) to your cart. `;
      
      // Check if there are more categories to process
      const nextIndex = contentData.currentIndex + 1;
      if (nextIndex < contentData.totalCategories) {
        const nextCategory = contentData.categories[nextIndex];
        response += `Now let's select from ${nextCategory.category} (${nextCategory.quantity} items).`;
        
        // Show next category after a delay
        setTimeout(() => {
          const nextCategoryData = {
            categories: contentData.categories,
            currentCategory: nextCategory.category,
            currentQuantity: nextCategory.quantity,
            currentIndex: nextIndex,
            totalCategories: contentData.totalCategories,
            message: `Now selecting ${nextCategory.quantity} items from ${nextCategory.category}:`
          };
          
          // Update multi-category bulk mode state
          setMultiCategoryBulkMode({
            categories: contentData.categories,
            currentIndex: nextIndex
          });
          
          addMessage('assistant', nextCategoryData, null, 1500, 'multi-bulk');
        }, 2000);
      } else {
        response += 'Perfect! You\'ve completed your multi-category order. All items have been added to your cart!';
        
        // Clear multi-category mode
        setTimeout(() => {
          setMultiCategoryBulkMode(null);
          showCartContents();
        }, 2000);
      }
      
      addMessage('assistant', response, item, 1000);
    }, 500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end justify-end p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-primary-600 text-white rounded-t-lg">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              🤖
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold">AI Chat Assistant</h3>
                <div className={`w-2 h-2 rounded-full ${
                  aiServiceStatus === 'connected' ? 'bg-green-400' :
                  aiServiceStatus === 'disconnected' ? 'bg-red-400' :
                  'bg-yellow-400'
                }`} title={`AI Service: ${aiServiceStatus}`}></div>
              </div>
              <p className="text-xs opacity-90">
                {isListening ? 'Listening...' : 
                 isProcessing ? 'Processing...' : 
                 isTyping ? 'Assistant is typing...' :
                 aiServiceStatus === 'connected' ? 
                   (inputMode === 'voice' ? 'AI-powered voice mode' : 'AI-powered chat mode') :
                   (inputMode === 'voice' ? 'Voice mode (AI offline)' : 'Chat mode (AI offline)')
                }
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleClearChat}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors"
              title="Clear chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 chat-scroll"
        >
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex flex-col ${
                message.type === 'user' ? 'items-end' : 'items-start'
              }`}>
                {/* Message sender label */}
                <div className={`text-xs text-gray-500 mb-1 px-1 ${
                  message.type === 'user' ? 'text-right' : 'text-left'
                }`}>
                  {message.type === 'user' ? 'You' : 'Assistant'}
                </div>
                
                <div
                  className={`${
                    message.messageType === 'menu' || message.messageType === 'category' 
                      ? 'max-w-[95%]' 
                      : 'max-w-[80%]'
                  } rounded-lg p-3 ${
                    message.type === 'user'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-800 shadow-sm border'
                  }`}
                >
                {/* Regular text message */}
                {(!message.messageType || message.messageType === 'text') && (
                  <p className="text-sm">{message.content}</p>
                )}
                
                {/* Rich menu display */}
                {message.messageType === 'menu' && (
                  <MenuMessage 
                    content={message.content} 
                    onCategoryClick={handleCategoryClick} 
                  />
                )}
                
                {/* Rich category display */}
                {message.messageType === 'category' && (
                  <CategoryMessage 
                    content={message.content} 
                    onItemClick={handleItemClick} 
                  />
                )}
                
                {/* Rich addons display */}
                {message.messageType === 'addons' && (
                  <AddonsMessage 
                    content={message.content} 
                    onItemClick={handleItemClick} 
                  />
                )}

                {/* Rich cart display */}
                {message.messageType === 'cart' && (
                  <CartMessage content={message.content} />
                )}

                {/* Rich alternatives display */}
                {message.messageType === 'alternatives' && (
                  <AlternativesMessage 
                    content={message.content} 
                    onItemClick={handleItemClick} 
                  />
                )}

                {/* Receipt display for successful orders */}
                {message.messageType === 'receipt' && (
                  <ReceiptMessage content={message.content} />
                )}

                {/* Multi-category bulk order display */}
                {message.messageType === 'multi-bulk' && (
                  <MultiBulkMessage 
                    content={message.content} 
                    menuData={menuData} 
                    onItemClick={handleMultiCategoryItemClick} 
                  />
                )}
                {message.messageType === 'bulk-menu' && (
                  <BulkMenuMessage 
                    content={message.content} 
                    menuData={menuData} 
                    onCategoryClick={handleCategoryClick} 
                    onItemClick={handleItemClick} 
                  />
                )}
                
                {/* Menu item preview for assistant messages */}
                {message.type === 'assistant' && message.menuItem && (
                  <div className="mt-3 p-3 bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg border-l-4 border-primary-600">
                    <div className="flex items-center space-x-3">
                      <img 
                        src={message.menuItem.image || '/api/placeholder/60/60'} 
                        alt={message.menuItem.name}
                        className="w-12 h-12 rounded-lg object-cover shadow-sm"
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-800">{message.menuItem.name}</p>
                        <p className="text-primary-600 font-bold text-sm">${message.menuItem.price}</p>
                        {message.menuItem.description && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{message.menuItem.description}</p>
                        )}
                      </div>
                      <div className="text-green-500">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
                
                <p className="text-xs opacity-70 mt-1">
                  {formatTime(message.timestamp)}
                </p>
                </div>
              </div>
            </div>
          ))}
          
          {/* Live transcript display */}
          {isListening && transcript && (
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-lg p-3 bg-gray-200 text-gray-600 border-2 border-dashed border-gray-400">
                <p className="text-sm italic">"{transcript}"</p>
                <p className="text-xs opacity-70 mt-1">Speaking...</p>
              </div>
            </div>
          )}
          
          {/* Typing indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg p-3 bg-white text-gray-800 shadow-sm border">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Assistant is typing</span>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-primary-600 rounded-full typing-dot"></div>
                    <div className="w-2 h-2 bg-primary-600 rounded-full typing-dot"></div>
                    <div className="w-2 h-2 bg-primary-600 rounded-full typing-dot"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Controls */}
        <div className="p-4 border-t bg-white rounded-b-lg">
          {/* Mode Toggle */}
          <div className="flex items-center justify-center space-x-2 mb-3">
            <button
              onClick={() => setInputMode('voice')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                inputMode === 'voice' 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🎤 Voice
            </button>
            <button
              onClick={() => setInputMode('text')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                inputMode === 'text' 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              💬 Chat
            </button>
          </div>
          
          {inputMode === 'voice' ? (
            /* Voice Input */
            <div>
              <div className="flex items-center justify-center space-x-4">
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isProcessing}
                  className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all transform ${
                    isListening
                      ? 'bg-red-500 hover:bg-red-600 scale-110 animate-pulse'
                      : 'bg-primary-600 hover:bg-primary-700 hover:scale-105'
                  } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''} text-white shadow-lg`}
                >
                  {isListening ? (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                  ) : (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                    </svg>
                  )}
                  
                  {/* Listening animation */}
                  {isListening && (
                    <div className="absolute inset-0 rounded-full border-4 border-white border-opacity-30 animate-ping"></div>
                  )}
                </button>
              </div>
              
              <p className="text-center text-sm text-gray-600 mt-2">
                {isListening ? 'Listening to your order...' : 
                 isProcessing ? 'Processing your request...' : 
                 'Tap to speak your order'}
              </p>
              
              {/* Browser compatibility warning */}
              {typeof window !== 'undefined' && !('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) && (
                <p className="text-center text-xs text-red-600 mt-1">
                  Voice recognition not supported in this browser
                </p>
              )}
            </div>
          ) : (
            /* Text Input */
            <form onSubmit={handleTextSubmit} className="space-y-3">
              <div className="flex space-x-2">
                <input
                  ref={textInputRef}
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type your order here... (e.g., 'show me pizzas', 'I want pasta', 'add salad')"
                  disabled={isProcessing}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || isProcessing}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isProcessing ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    'Send'
                  )}
                </button>
              </div>
              
              <p className="text-center text-xs text-gray-500">
                Examples: "Show me pizzas", "I want pasta", "Add 2 burgers", "Remove pizza", "Show my cart"
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBot;