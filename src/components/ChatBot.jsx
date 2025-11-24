import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { addToCart, removeFromCart, updateQuantity, clearCart } from '../store/cartSlice';
import { useQuery } from '@apollo/client';
import { GET_MENU_ITEMS } from '../apollo/queries';
import ReceiptMessage from './chatbot/ReceiptMessage';
import CartMessage from './chatbot/CartMessage';

// AI Chatbot Service Configuration
const CHATBOT_SERVICE_URL = 'http://localhost:5000';
const SESSION_ID = 'restaurant_chat_' + Date.now();

const ChatBot = ({ isOpen, onClose }) => {
  // Start with an empty chat; assistant text will come from the backend /chat endpoint.
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [inputMode, setInputMode] = useState('voice'); // 'voice' or 'text'
  const [isTyping, setIsTyping] = useState(false);
  const [aiServiceStatus, setAiServiceStatus] = useState('checking'); // 'connected', 'disconnected', 'checking'
  const [userMood, setUserMood] = useState(null);
  const [empathyLevel, setEmpathyLevel] = useState('standard');
  const [_HAS_ASKED_FOR_ADDONS, setHasAskedForAddons] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [bulkQuantityMode, setBulkQuantityMode] = useState(null);
  const [multiCategoryBulkMode, setMultiCategoryBulkMode] = useState(null);
  
  // Voice response states
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechSynthesisRef = useRef(null);
  
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
      // Use AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${CHATBOT_SERVICE_URL}/health`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const healthData = await response.json();
        if (healthData.ai_status === 'rate_limited') {
          setAiServiceStatus('rate_limited');
          console.log('⚠️ AI service rate limited');
        } else {
          setAiServiceStatus('connected');
          console.log('✅ AI service connected');
        }
      } else {
        setAiServiceStatus('disconnected');
        console.warn('⚠️ AI service responded with error:', response.status);
      }
    } catch (error) {
      setAiServiceStatus('disconnected');
      if (error.name === 'AbortError') {
        console.warn('⚠️ AI service health check timeout');
      } else {
        console.warn('⚠️ AI service unreachable:', error.message);
      }
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
  }, []);
  
  // Add function to handle clear chat
  const handleClearChat = async () => {
    try {
      // Call backend to clear session and use backend reply as assistant message
      const resp = await fetch(`${CHATBOT_SERVICE_URL}/clear_session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: SESSION_ID })
      });
      const json = await resp.json();
      // backend returns a message; use it as the single assistant message
      const assistantMessage = (json.message) ? json.message : 'Chat cleared.';
      setMessages([
        { id: Date.now(), type: 'assistant', content: assistantMessage, timestamp: new Date() }
      ]);
      setUserMood(null);
      setEmpathyLevel('standard');
      setBulkQuantityMode(null);
      setMultiCategoryBulkMode(null);
      setIsTyping(false);
      setIsProcessing(false);
    } catch (error) {
      console.error('Error clearing AI session:', error);
      // Fallback minimal frontend message only when backend unreachable
      setMessages([{ id: Date.now(), type: 'assistant', content: 'Chat cleared (offline).', timestamp: new Date() }]);
      setUserMood(null);
      setEmpathyLevel('standard');
    }
  };
  // Keep a ref to the current handleUserInput to avoid stale closures in the speech recognition callback
  // Keep a ref to the current handleUserInput to avoid stale closures in the speech recognition callback
  const handleUserInputRef = useRef(null);

  useEffect(() => {
    // Initialize Speech Recognition
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.maxAlternatives = 1;

      recognitionRef.current.onstart = () => {
        console.log('🎤 Speech recognition started');
        setIsListening(true);
        setTranscript('');
      };

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptText = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptText;
          } else {
            interimTranscript += transcriptText;
          }
        }

        // Show live transcript
        setTranscript(finalTranscript || interimTranscript);

        // Process final transcript
        if (finalTranscript) {
          console.log('🎤 Final transcript:', finalTranscript);
          // Use the ref to call the latest version of handleUserInput
          if (handleUserInputRef.current) {
            handleUserInputRef.current(finalTranscript);
          }
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        
        // Better error messages based on error type
        let errorMessage = 'Sorry, I couldn\'t hear you clearly.';
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'I didn\'t hear anything. Please try again.';
            break;
          case 'audio-capture':
            errorMessage = 'Microphone not found. Please check your device.';
            break;
          case 'not-allowed':
            errorMessage = 'Microphone access denied. Please allow microphone access.';
            break;
          case 'network':
            errorMessage = 'Network error. Please check your connection.';
            break;
          default:
            errorMessage = `Voice recognition error: ${event.error}. Please try again.`;
        }
        
        if (event.error !== 'aborted') {
          addMessage('assistant', errorMessage);
          speak(errorMessage);
        }
      };

      recognitionRef.current.onend = () => {
        console.log('🎤 Speech recognition ended');
        setIsListening(false);
      };
    }

    // Initialize Speech Synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthesisRef.current = window.speechSynthesis;
      console.log('🔊 Speech synthesis available');
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error('Error stopping recognition:', e);
        }
      }
      if (speechSynthesisRef.current) {
        speechSynthesisRef.current.cancel();
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

  // Helper: remove JSON objects / raw json fragments from assistant text
  const stripJsonFromText = (text = '') => {
    if (typeof text !== 'string') return text;
    // Remove fenced ```json ... ``` blocks
    let cleaned = text.replace(/```json[\s\S]*?```/gi, '');
    // Remove occurrences of the word "json" followed by a colon or braces
    cleaned = cleaned.replace(/\bjson\b[:=\s]*/gi, '');
    // Remove any {...} JSON-like balanced blocks (best-effort)
    cleaned = cleaned.replace(/\{[\s\S]*?\}/g, '');
    // Remove common trailing "order" summaries that look like key:value sets
    cleaned = cleaned.replace(/"action"\s*:\s*".*?"/gi, '');
    // Normalize whitespace and trim
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    return cleaned;
  };

  // Keep detector for analytics only — do NOT emit assistant messages from frontend.
  // Simple client-side emotion detector (keywords). Returns { emotion, intensity, reason }.
  const detectEmotionFromText = (text = '') => {
    const t = (text || '').toLowerCase();
    if (!t) return { emotion: 'neutral', intensity: 'low', reason: 'empty' };

    // broader negative and positive cues, plus first-person emotional statements
    const negative = ['sad', 'upset', 'angry', 'terrible', 'awful', 'worst', 'hate', 'miserable', 'frustrat', 'disappoint', 'not happy', "don't", "do not", 'stressed', 'anxious', 'lonely', 'sick'];
    const positive = ['great', 'happy', 'awesome', 'love', 'good', 'delicious', 'thanks', 'thank you', 'excited'];
    const polite = ['please', 'could you', 'would you'];

    const contains = (arr) => arr.some(k => t.includes(k));
    // detect explicit first-person feeling e.g. "i am sad", "i'm feeling awful"
    const firstPersonFeeling = /\b(i am|i'm|i feel|i've been)\s+([a-z]{3,})/i.exec(text);

    let emotion = 'neutral';
    let intensity = 'low';
    let reason = 'keywords';

    if (contains(negative) || (firstPersonFeeling && /sad|upset|angry|frustr|terribl|awful|miser|anxio|stres|depress|lonely|sick/.test(firstPersonFeeling[2].toLowerCase()))) {
      emotion = 'negative';
      // stronger intensity if "very", "so", "really", or strong words present or exclamation
      const strongNeg = ['terrible', 'awful', 'hate', 'worst', 'miserable', 'horrible', 'sobbing'];
      intensity = (/(very|so|really|extremely)/i.test(text) || contains(strongNeg) || /!{2,}/.test(text)) ? 'high' : 'medium';
      reason = firstPersonFeeling ? 'first_person' : 'keywords';
    } else if (contains(positive)) {
      emotion = 'positive';
      intensity = /!{1,}/.test(text) ? 'medium' : 'low';
      reason = 'keywords';
    } else if (contains(polite)) {
      emotion = 'neutral';
      intensity = 'low';
      reason = 'polite';
    }

    return { emotion, intensity, reason };
  };

  // Helper: format message timestamps (prevents ReferenceError in render)
  const formatTime = (timestamp) => {
    try {
      const d = timestamp ? new Date(timestamp) : new Date();
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Text-to-Speech function
  const speak = (text) => {
    if (!voiceEnabled || !text) return;
    
    if (speechSynthesisRef.current) {
      // Cancel any ongoing speech
      speechSynthesisRef.current.cancel();
      
      // Clean the text (remove JSON, special characters)
      const cleanText = stripJsonFromText(text)
        .replace(/[{}[\]"]/g, '')
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (!cleanText) return;
      
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'en-US';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onstart = () => {
        console.log('🔊 Speaking:', cleanText);
        setIsSpeaking(true);
      };
      
      utterance.onend = () => {
        console.log('🔊 Finished speaking');
        setIsSpeaking(false);
      };
      
      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setIsSpeaking(false);
      };
      
      speechSynthesisRef.current.speak(utterance);
    }
  };

  // Stop speaking function
  const stopSpeaking = () => {
    if (speechSynthesisRef.current) {
      speechSynthesisRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const generateReceiptFromCart = (providedOrder = null) => {
    // Use provided order data if available (from actionData), otherwise build from cartItems
    if (providedOrder && (providedOrder.items || providedOrder.order_total)) {
      return {
        order_id: providedOrder.order_id || `ORD-${Date.now()}`,
        items: providedOrder.items || cartItems.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price, total: i.totalPrice || i.price * i.quantity })),
        order_total: providedOrder.order_total || cartItems.reduce((s, it) => s + (it.totalPrice || it.price * it.quantity), 0),
        placed_at: providedOrder.placed_at || new Date().toISOString()
      };
    }

    const items = cartItems.map(i => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      total: i.totalPrice || (i.price * i.quantity)
    }));

    const order_total = parseFloat(items.reduce((sum, it) => sum + it.total, 0).toFixed(2));
    return {
      order_id: `ORD-${Date.now()}`,
      items,
      order_total,
      placed_at: new Date().toISOString()
    };
  };

  // Return a small, stable receipt/cart shape that chat UI components expect.
  const sanitizeReceiptForChat = (raw) => {
    if (!raw) return { items: [], order_total: 0, order_id: `ORD-${Date.now()}` };
    const items = (raw.items || []).map(it => {
      const qty = Number(it.quantity || it.qty || 1);
      const price = Number(it.price || it.unit_price || 0) || 0;
      const total = Number((it.total ?? (price * qty)).toFixed(2));
      return { name: it.name || 'Item', quantity: qty, price, total };
    });
    const subtotal = Number((items.reduce((s, it) => s + (it.total || 0), 0)).toFixed(2));
    const tax = Number((subtotal * 0.08).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));
    return {
      order_id: raw.order_id || raw.orderId || `ORD-${Date.now()}`,
      items,
      subtotal,
      tax,
      total,
      order_total: Number(raw.order_total || total || 0)
    };
  };
  
  // REMOVE frontend empathy prefixing: assistant text must come from backend only.
  // (keep composeEmpatheticPrefix removed)

  const addMessage = (type, content, menuItem = null, delay = 0, messageType = 'text') => {
    // addMessage now only sanitizes assistant text (no frontend-generated empathy or greetings).
    if (type === 'assistant' && typeof content === 'string' && messageType === 'text') {
      content = stripJsonFromText(content);
    }

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
        
        // Speak the assistant message if voice is enabled and it's text
        if (type === 'assistant' && messageType === 'text' && typeof content === 'string') {
          setTimeout(() => speak(content), 100);
        }
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
        
        // Speak the assistant message if voice is enabled and it's text
        if (messageType === 'text' && typeof content === 'string') {
          setTimeout(() => speak(content), 100);
        }
      }
    }
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening && !isProcessing) {
      try {
        // Stop any ongoing speech before listening
        stopSpeaking();
        recognitionRef.current.start();
        console.log('🎤 Starting speech recognition...');
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        const errorMsg = 'Voice recognition is not available. Please try using text mode.';
        addMessage('assistant', errorMsg);
        speak(errorMsg);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
        console.log('🎤 Stopping speech recognition...');
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
        setIsListening(false);
      }
    }
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (textInput.trim() && !isProcessing) {
      handleUserInput(textInput.trim());
      setTextInput('');
    }
  };

  const handleConfirmPlaceOrder = async () => {
    if (isProcessing) return;
    try {
      setIsProcessing(true);

      // Build a sanitized receipt shape the UI components expect
      const rawReceipt = generateReceiptFromCart();
      const sanitized = sanitizeReceiptForChat(rawReceipt);

      const items = (sanitized.items || []).map(it => ({
        name: it.name,
        quantity: Number(it.quantity || 1),
        total: Number(it.total || (it.price ? it.price * (it.quantity || 1) : 0))
      }));

      const subtotal = Number((sanitized.subtotal ?? items.reduce((s, it) => s + (it.total || 0), 0)).toFixed(2));
      const tax = Number((sanitized.tax ?? (subtotal * 0.08)).toFixed(2));
      const total = Number((sanitized.total ?? (subtotal + tax)).toFixed(2));

      const receiptContent = {
        orderId: sanitized.order_id || `ORD-${Date.now()}`,
        orderTime: new Date().toLocaleString(),
        items,
        subtotal,
        tax,
        total,
        estimatedTime: sanitized.estimatedTime || '15-25 mins'
      };

      // Clear the cart (do this after snapshotting receipt to avoid race)
      dispatch(clearCart());

      // Save receipt state for modal or other UI
      setReceiptData(receiptContent);
      setShowReceiptModal(true);

      // Friendly assistant confirmation (sanitized by addMessage)
      addMessage('assistant', 'Thanks — placing your order now. Here is your receipt.', null, 500);

      // Push the structured receipt message (ReceiptMessage expects 'content' prop with this shape)
      addMessage('assistant', 'Here is your receipt.', receiptContent, 1000, 'receipt');
    } catch (err) {
      console.error('Error placing order:', err);
      addMessage('assistant', "Sorry — I couldn't place your order right now. Please try again.", null, 300);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleCancelPlaceOrder = () => {
    addMessage('assistant', "No problem — I won't place the order. Let me know if you'd like to change anything.", null, 300);
  };

  // detect "place order" locally before sending to backend (quick UX improvement)
  const handleUserInput = async (userText) => {
    setIsProcessing(true);

    // quick local handling for explicit checkout phrases
    const placeOrderPhrases = ['place order', 'proceed with order', 'checkout', 'order now', 'complete order'];
    if (placeOrderPhrases.some(p => userText.toLowerCase().includes(p))) {
      // Check if cart has items
      if (!cartItems || cartItems.length === 0) {
        addMessage('assistant', 'Your cart is empty. Please add some items before placing an order.');
        setIsProcessing(false);
        setTranscript('');
        return;
      }
      
      // show CartMessage summary in chat and ask for confirmation
      const rawReceipt = generateReceiptFromCart();
      const sanitized = sanitizeReceiptForChat(rawReceipt);
      console.log('🛒 Cart confirm - sanitized:', sanitized);
      // Use the sanitized minimal shape for CartMessage to avoid runtime errors
      addMessage('assistant', 'Would you like to proceed to place your order?', sanitized, 200, 'cart_confirm');
      setIsProcessing(false);
      setTranscript('');
      return;
    }

    // Add user message
    addMessage('user', userText);
    
    // Show typing animation immediately
    setIsTyping(true);

    // Do NOT send any assistant messages from frontend. Send userText to backend and let backend reply.
    // Keep minimal client-side mood state for context only.
    const detected = detectEmotionFromText(userText);
    setUserMood(detected);
    if (detected.emotion === 'negative' && detected.intensity === 'high') {
      setEmpathyLevel('high');
    } else {
      setEmpathyLevel('standard');
    }

    try {
      // Prepare cart data for AI context
      const cartData = cartItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.totalPrice || (item.price * item.quantity)
      }));
      
      // Use AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      // Call AI chatbot service
      console.log('📤 Sending message to AI:', userText);
      const response = await fetch(`${CHATBOT_SERVICE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: userText,
          session_id: SESSION_ID,
          cart_items: cartData,
          user_mood: userMood,
          empathy_level: empathyLevel
        })
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('❌ Chatbot service error:', response.status, errorText);
        throw new Error(`Chatbot service error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📥 Received AI response:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'AI response error');
      }

      // Update mood state from backend response
      if (data.emotional_state) {
        setUserMood(data.emotional_state);
        if (data.emotional_state.emotion === 'negative' && data.emotional_state.intensity === 'high') {
          setEmpathyLevel('high');
        }
      }

      // Stop typing animation before processing response
      setIsTyping(false);

      // DEBUG: Log full response from backend
      console.log('📥 Backend response:', {
        response: data.response,
        action: data.action_data?.action,
        action_data: data.action_data,
        success: data.success
      });

      // If server returned an early action, handle greetings specially so we don't duplicate messages.
      const earlyAction = data.action_data && data.action_data.action;
      if (earlyAction === 'greeting') {
        // Prefer server-provided response text, fall back to action_data.response_text
        const greetText = data.response || data.action_data?.response_text || "Hello!";
        const delay = data.action_data?.response_delay || 500;
        // Add a single assistant message and DO NOT call processAIResponse to avoid duplication
        addMessage('assistant', greetText, null, delay);
        // Update mood/empathy if server provided emotional_state
        if (data.emotional_state) {
          setUserMood(data.emotional_state);
          if (data.emotional_state.emotion === 'negative' && data.emotional_state.intensity === 'high') {
            setEmpathyLevel('high');
          }
        }
        setIsProcessing(false);
        setTranscript('');
        return;
      }

      // If backend provided an immediate supportive follow_up message, show it first (prioritize empathy)
      if (data.follow_up && data.follow_up.message) {
        addMessage('assistant', data.follow_up.message, null, data.follow_up.response_delay || 800);
      }

      // Use backend-provided visible response (may already include empathy/greeting override)
      const visibleResponse = data.response || '';

      // PRIORITY: If backend signaled emotional_state negative, show empathy and avoid auto-opening the menu
      let preventAutoMenuOpen = false;
      const empathyKeywords = ["sorry", "i'm really sorry", "i am really sorry", "i'm sorry", "i am sorry", "i care", "i'm here to help", "comfort"];
      const visibleLower = visibleResponse.toLowerCase();

      if (data.emotional_state && data.emotional_state.emotion === 'negative') {
        preventAutoMenuOpen = true;
        // do NOT emit the visibleResponse here to avoid duplicate messages;
        // processAIResponse will render assistant output (including empathy) in a single place.
        // we keep the fallback empathy text only if backend sent no visibleResponse
        const hasEmpathyText = empathyKeywords.some(k => visibleLower.includes(k));
        if (!visibleResponse || !hasEmpathyText) {
          const fallbackEmpathy = "I'm really sorry to hear that. I can suggest something comforting from the menu, open the menu, place an order for you, or just listen. Which would you prefer?";
          // show fallback if backend gave nothing
          addMessage('assistant', fallbackEmpathy, null, 0);
        }
      }
      // PRIORITY HANDOFF: hand off to processAIResponse which will add the assistant message exactly once
      await processAIResponse(visibleResponse, data.action_data || { action: 'none' });

      // Only auto-open the menu when action is explicitly show_menu AND we are NOT preventing it due to empathy
      if (data.action_data && data.action_data.action === 'show_menu') {
        const alreadyUserUpset = (userMood && userMood.emotion === 'negative') || (data.emotional_state && data.emotional_state.emotion === 'negative');
        if (!preventAutoMenuOpen && !alreadyUserUpset) {
          setTimeout(() => openMenuPanel(), 1000);
        } else {
          // empathy path — do not auto-open menu
          console.log('[ChatBot] suppressed auto-open menu because empathy was prioritized');
        }
      }
      
    } catch (error) {
      console.error('❌ AI Chatbot Error:', error);
      
      // Stop typing animation on error
      setIsTyping(false);
      
      // Provide specific error message based on error type
      let errorMessage = '';
      if (error.name === 'AbortError') {
        errorMessage = 'The request took too long. Please try again.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to AI service. Please make sure the chatbot service is running.';
      } else if (error.message.includes('NetworkError')) {
        errorMessage = 'Network error. Please check your connection.';
      } else {
        errorMessage = `Error: ${error.message}`;
      }
      
      addMessage('assistant', errorMessage);
      speak(errorMessage);
      
      
    }
    
    setIsProcessing(false);
    setTranscript('');
  };
  
  const processAIResponse = async (response, actionData) => {
    const delay = actionData?.response_delay || 1500;

    
    if (typeof response === 'string' && response.trim().length > 0) {
      addMessage('assistant', response, null, delay);
    }

    

    // helper: pick a friendly positive comment for an added item
    // const pickPositiveComment = (actionItem, menuItem) => {
    //   if (actionItem && actionItem.human_comment) return actionItem.human_comment;
    //   if (menuItem && menuItem.description) {
    //     const first = menuItem.description.split('.')[0].trim();
    //     if (first) return `${first}. A customer favorite!`;
    //   }
    //   if (menuItem && menuItem.category) {
    //     const cat = menuItem.category.toLowerCase();
    //     if (cat.includes('pizza')) return 'Cheesy and satisfying — a great pick!';
    //     if (cat.includes('salad')) return 'Fresh and crisp — a light, tasty choice.';
    //     if (cat.includes('dessert')) return 'Sweet and delightful — perfect to finish your meal.';
    //   }
    //   return 'Great pick — many customers love this!';
    // };

    // Helper to create and show receipt and clear cart
    const placeOrderAndShowReceipt = (orderSourceData = null) => {
      // Generate receipt (from actionData if available, otherwise from current cart)
      const rawReceipt = generateReceiptFromCart(orderSourceData);

      // Build content shape expected by ReceiptMessage.jsx
      const items = (rawReceipt.items || []).map(it => {
        const total = Number((it.total ?? (it.price && it.quantity ? it.price * it.quantity : it.price) ?? 0).toFixed(2));
        return {
          name: it.name,
          quantity: it.quantity || 1,
          total
        };
      });

      const subtotal = Number(items.reduce((s, it) => s + (it.total || 0), 0).toFixed(2));
      const tax = Number((subtotal * 0.08).toFixed(2)); // 8% tax as shown in ReceiptMessage
      const total = Number((subtotal + tax).toFixed(2));

      const receiptContent = {
        orderId: rawReceipt.order_id || rawReceipt.orderId || `ORD-${Date.now()}`,
        orderTime: rawReceipt.placed_at ? new Date(rawReceipt.placed_at).toLocaleString() : (rawReceipt.placedAt ? new Date(rawReceipt.placedAt).toLocaleString() : new Date().toLocaleString()),
        items,
        subtotal,
        tax,
        total,
        estimatedTime: rawReceipt.estimatedTime || '15-25 mins'
      };

      // Clear the cart
      dispatch(clearCart());

      // Save receipt in state (optional)
      setReceiptData(receiptContent);

      addMessage('assistant', null, receiptContent, 0, 'receipt');
    };

    // Handle different action types
    console.log('🔍 Frontend received action:', actionData?.action, 'with data:', actionData);
    switch ((actionData && actionData.action) || 'unknown') {
      case 'add':
        {
          const items = actionData.items || [];
          if (!items || items.length === 0) {
            break;
          }

          for (const item of items) {
            const qty = Number(item.quantity || 1);
            const menuItem = findMenuItemByName(item.name);
            if (menuItem) {
              dispatch(addToCart({
                id: menuItem.id,
                name: menuItem.name,
                price: menuItem.price || 0,
                quantity: qty
              }));
            } else {
              // fallback: create a synthetic cart item when menu lookup fails
              const fallbackId = `custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
              const fallbackName = (item.name || '').trim();
              dispatch(addToCart({
                id: fallbackId,
                name: fallbackName || 'Unknown Item',
                price: Number(item.price || 0) || 0,
                quantity: qty
              }));
            }
          }
        }
          break;

      case 'add_multiple':
        // Handle adding multiple different items to cart
        if (actionData.items && actionData.items.length > 0) {
          for (const item of actionData.items) {
            const qty = Number(item.quantity || 1);
            const menuItem = findMenuItemByName(item.name);
            if (menuItem) {
              dispatch(addToCart({
                id: menuItem.id,
                name: menuItem.name,
                price: menuItem.price || 0,
                quantity: qty
              }));
            } else {
              const fallbackId = `custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
              const fallbackName = (item.name || '').trim();
              dispatch(addToCart({
                id: fallbackId,
                name: fallbackName || 'Unknown Item',
                price: Number(item.price || 0) || 0,
                quantity: qty
              }));
            }
          }
        }
        break;

      case 'add_multiple_partial':
        // Handle adding multiple items where some weren't found
        if (actionData.items && actionData.items.length > 0) {
          for (const item of actionData.items) {
            const qty = Number(item.quantity || 1);
            const menuItem = findMenuItemByName(item.name);
            if (menuItem) {
              dispatch(addToCart({
                id: menuItem.id,
                name: menuItem.name,
                price: menuItem.price || 0,
                quantity: qty
              }));
            } else {
              const fallbackId = `custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
              const fallbackName = (item.name || '').trim();
              dispatch(addToCart({
                id: fallbackId,
                name: fallbackName || 'Unknown Item',
                price: Number(item.price || 0) || 0,
                quantity: qty
              }));
            }
          }
        }
        break;
        
      case 'item_not_found': {
        // Handle when requested items are not found
        break;
      }
        
      case 'remove': {
        if (actionData.items && actionData.items.length > 0) {
          for (const item of actionData.items) {
            const qty = Number(item.quantity || 0);
            let cartItem = null;
            if (item.id) {
              cartItem = cartItems.find(ci => ci.id === item.id) || null;
            }
            if (!cartItem && item.name) {
              const matches = findCartItemsByName(item.name);
              cartItem = matches[0] || null;
            }
            if (cartItem) {
              if (qty > 0 && qty < cartItem.quantity) {
                dispatch(updateQuantity({ id: cartItem.id, quantity: cartItem.quantity - qty }));
              } else {
                dispatch(removeFromCart(cartItem.id));
              }
            }
          }
        }
        break;
      }
        
      case 'remove_all':
        if (actionData.target_item) {
          const targetItem = actionData.target_item;
          console.log('🗑️ Processing remove_all for:', targetItem);
          
          const nameMatches = findCartItemsByName(targetItem);
          console.log('🗑️ Name matches:', nameMatches);
          
          const categoryMatches = cartItems.filter(ci => {
            const menuItem = (menuData?.menuItems || []).find(mi => mi.id === ci.id || _normalize(mi.name) === _normalize(ci.name));
            if (!menuItem) return false;
            const tgt = _tokens(targetItem);
            const cat = _tokens(menuItem.category || '');
            return _score(tgt, cat) >= 0.5 || menuItem.category?.toLowerCase().includes(targetItem.toLowerCase());
          });
          console.log('🗑️ Category matches:', categoryMatches);
          
          const byIdMatches = actionData.items ? actionData.items.map(it => it.id).filter(Boolean).map(id => cartItems.find(ci => ci.id === id)).filter(Boolean) : [];
          
          const itemsToRemove = [...new Set([...nameMatches, ...categoryMatches, ...byIdMatches])];
          console.log('🗑️ Items to remove:', itemsToRemove);
          
          if (itemsToRemove.length > 0) {
            itemsToRemove.forEach(item => {
              console.log('🗑️ Dispatching removeFromCart for:', item.name, item.id);
              dispatch(removeFromCart(item.id));
            });
            // Add confirmation message
            addMessage('assistant', `Removed all ${targetItem} from your cart.`);
          } else {
            console.log('🗑️ No items found to remove');
            addMessage('assistant', `I couldn't find any ${targetItem} in your cart to remove.`);
          }
        }
        break;

      case 'update':
        if (actionData.operation) {
          const operation = actionData.operation; // 'increase' or 'decrease'
          const targetItem = actionData.target_item || actionData.target;
          const quantity = actionData.quantity || 1;
          let cartItem = null;
          if (actionData.id) {
            cartItem = cartItems.find(ci => ci.id === actionData.id) || null;
          }
          if (!cartItem && targetItem) {
            cartItem = findCartItemsByName(targetItem)[0] || null;
          }
          
          if (cartItem) {
            if (operation === 'increase') {
              dispatch(updateQuantity({ id: cartItem.id, quantity: cartItem.quantity + quantity }));
            } else if (operation === 'decrease') {
              const newQuantity = cartItem.quantity - quantity;
              if (newQuantity <= 0) {
                dispatch(removeFromCart(cartItem.id));
              } else {
                dispatch(updateQuantity({ id: cartItem.id, quantity: newQuantity }));
              }
            }
          }
        }
        break;
        
      case 'show_menu':
        openMenuPanel(actionData?.category || null);
        break;
        
      case 'show_category':
        if (actionData.category) {
          openMenuPanel(actionData.category);
        }
        break;
        
      case 'show_cart':
        break;
        
      case 'clear_cart':
        dispatch(clearCart());
        break;
        
      case 'checkout':
        if (cartItems.length > 0) {
          setTimeout(() => {
            placeOrderAndShowReceipt();
          }, 1200);
        }
        break;

      case 'place_order':
        // If backend returned order details in actionData, use them
        placeOrderAndShowReceipt(actionData.order || actionData);
        break;

      case 'bulk_quantity':
        if (actionData.item_type) {
          setBulkQuantityMode({ quantity: 1, itemType: actionData.item_type });
        }
        break;
        
      case 'multi_category_bulk':
        // Handle multi-category bulk mode
        if (actionData.categories && actionData.categories.length > 0) {
          setMultiCategoryBulkMode({ categories: actionData.categories, currentIndex: 0 });
          handleCategoryClick(actionData.categories[0].category);
        }
        break;
        
      case 'ask_addons':
        if (actionData.item_name) {
          setHasAskedForAddons(true);
        }
        break;
        
      case 'confirm_addons':
        if (actionData.item_name) {
          setHasAskedForAddons(false);
        }
        break;
        
      case 'cancel_addons':
        if (actionData.item_name) {
          setHasAskedForAddons(false);
        }
        break;
        
      case 'unknown':
        break;
        
      default:
        break;
    }
  };
  
  
  
  // Improved item name matcher: stronger normalization, token singularization, and token-overlap scoring.
  // Helper: normalize text for comparisons
  const _normalize = (s = '') =>
    s
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[’‘'"]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // Return best matching menu item for a given free-text name (or null)
  const findMenuItemByName = (name) => {
    if (!menuData?.menuItems?.length || !name) return null;

    // Clean up common container/unit words and simple plural forms that users often say:
    // e.g. "Apple Juice can", "Coca Colas", "2 Garden Salads" -> "apple juice", "coca cola", "garden salad"
    const cleanedName = (name || '')
      .replace(/\b(can|cans|bottle|bottles|pack|packs|cup|cups|slice|slices|piece|pieces)\b/gi, '')
      .replace(/\b(\d+)\b/gi, '') // remove raw numeric tokens leftover
      .trim();
    // simple singularization: strip trailing 's' for common plurals (very small heuristic)
    const singularized = cleanedName.replace(/\b([a-z]+)s\b/gi, '$1');
    const targetNorm = _normalize(singularized);
    const targetTokens = targetNorm.split(' ').filter(Boolean);

    // helper: score two token arrays (precision-weighted)
    const scoreMatch = (targetToks, itemToks) => {
      const common = targetToks.filter(t => itemToks.includes(t)).length;
      const precision = common / (targetToks.length || 1); // proportion of target matched
      const recall = common / (itemToks.length || 1); // proportion of item matched
      // favor precision (we want target tokens to map to item tokens)
      return precision * 0.7 + recall * 0.3;
    };

    // precompute normalized menu tokens
    const items = menuData.menuItems.map(it => ({
      raw: it,
      norm: _normalize(it.name),
      toks: _normalize(it.name).split(' ').filter(Boolean)
    }));

    // 1) Exact normalized string match
    const exact = items.find(it => it.norm === targetNorm);
    if (exact) return exact.raw;

    // 2) Prefer items where all target tokens are contained in item tokens (strong match)
    const subsetMatch = items.find(it => targetTokens.every(t => it.toks.includes(t)));
    if (subsetMatch) return subsetMatch.raw;

    // 3) Token-overlap scoring: prefer highest score, require threshold
    let best = null;
    let bestScore = 0;
    for (const it of items) {
      const s = scoreMatch(targetTokens, it.toks);
      // small boost if normalized item contains the full target phrase (substring)
      if (it.norm.includes(targetNorm) || targetNorm.includes(it.norm)) {
        // boost but still respect scoring
        const boosted = Math.max(s, 0.5);
        if (boosted > bestScore) {
          bestScore = boosted;
          best = it;
        }
      } else if (s > bestScore) {
        bestScore = s;
        best = it;
      }
    }

    // require reasonable confidence to avoid false positives
    if (best && bestScore >= 0.45) return best.raw;

    // 4) Final loose fallback: try substring containment with cleaned tokens (more forgiving)
    for (const it of items) {
      if (it.norm.includes(targetNorm) || targetNorm.includes(it.norm)) return it.raw;
    }
    for (const t of targetTokens) {
      const found = items.find(it => it.toks.includes(t));
      if (found) return found.raw;
    }

    return null;
  };

  const _tokens = (s = '') => _normalize(s).split(' ').filter(Boolean);
  const _score = (a, b) => {
    const common = a.filter(t => b.includes(t)).length;
    const precision = common / (a.length || 1);
    const recall = common / (b.length || 1);
    return precision * 0.7 + recall * 0.3;
  };
  const findCartItemsByName = (name) => {
    const targetNorm = _normalize(name || '');
    const tTok = targetNorm.split(' ').filter(Boolean);
    const results = [];
    for (const ci of cartItems) {
      const ciNorm = _normalize(ci.name || '');
      const ciTok = ciNorm.split(' ').filter(Boolean);
      const score = _score(tTok, ciTok);
      const strong = score >= 0.5;
      const loose = score >= 0.3 || ciNorm.includes(targetNorm) || targetNorm.includes(ciNorm);
      if (strong || loose) {
        results.push({ item: ci, score: Math.max(score, loose ? 0.3 : score) });
      }
    }
    return results.sort((a, b) => b.score - a.score).map(x => x.item);
  };

  // Parse item/quantity pairs from free text with greedy merging so multi-word items like
  // "Fish and Chips" are preserved.
  const parseItemsFromText = (text = '') => {
    if (!text) return [];
    const results = [];
    
    console.log('🔍 parseItemsFromText input:', text);
    
    // Convert word numbers to digits first ("two pizzas" -> "2 pizzas")
    text = text.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|a|an)\b/gi, 
      (match) => {
        const wordToNumber = {
          'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
          'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
          'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
          'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
          'a': 1, 'an': 1
        };
        const num = wordToNumber[match.toLowerCase()];
        return num !== undefined ? num.toString() : match;
      });
    
    console.log('🔍 After word-to-number conversion:', text);

    // normalize quick helper
    const quickNorm = s => _normalize(s);

    // Filter out common voice command words that aren't food items
    const commandWords = /^(to|the|some|please|can|i|want|would|like|order|add|give|me|my|get|need|more)$/i;
    const cleanItemName = (name) => {
      return name.split(/\s+/)
        .filter(word => !commandWords.test(word))
        .join(' ')
        .trim();
    };

    // 1) explicit quantity patterns like "2 Fish and Chips" or "1 Grilled Salmon"
    const qtyRegex = /(\d+)\s+([A-Za-z0-9&'’\-\s]+?)(?=(?:\s+(?:and|,|&)\s+\d|\s*$|[.,!?]))/gi;
    let m;
    while ((m = qtyRegex.exec(text)) !== null) {
      const qty = parseInt(m[1], 10) || 1;
      let name = m[2].trim().replace(/[.,!?]$/, '');
      name = cleanItemName(name); // Clean command words
      if (name && name.length > 2) { // Ensure name is meaningful
        const menuItem = findMenuItemByName(name);
        if (menuItem) {
          results.push({ name: menuItem.name, quantity: qty });
        }
      }
    }
    if (results.length > 0) {
      console.log('✅ parseItemsFromText results (pattern 1):', results);
      return results;
    }

    // 2) try "I want X and Y" style without explicit numbers (also handles remove, increase, decrease)
    const wantsMatch = text.match(/(?:i want|i'd like|i would like|order|add|remove|delete|increase|decrease|reduce|i want to order|to order)\s+(.+)$/i);
    if (wantsMatch) {
      let raw = wantsMatch[1].trim().replace(/[.?!]$/, '');
      
      // Extract quantity BEFORE cleaning (e.g., "2 pizzas" -> qty=2, name="pizzas")
      const leadingNumBeforeClean = raw.match(/^\s*(\d+)\s+(.*)$/);
      const extractedQty = leadingNumBeforeClean ? (parseInt(leadingNumBeforeClean[1], 10) || 1) : 1;
      const nameAfterQty = leadingNumBeforeClean ? leadingNumBeforeClean[2] : raw;
      
      // Now clean the item name (removes command words)
      const cleanedName = cleanItemName(nameAfterQty);
      
      if (!cleanedName || cleanedName.length < 2) return []; // Skip if cleaned text is too short
      
      // If whole phrase exactly matches a menu item treat as single item
      const wholeMatch = menuData?.menuItems?.some(it => quickNorm(it.name) === quickNorm(cleanedName));
      if (wholeMatch) {
        const menuItem = findMenuItemByName(cleanedName);
        if (menuItem) {
          results.push({ name: menuItem.name, quantity: extractedQty });
          return results;
        }
      }

      // split on separators but then greedily merge adjacent parts to match menu items
      const parts = cleanedName.split(/\s+(?:and|&|,)\s+/i).map(p => p.trim()).filter(Boolean);

      const consumed = new Array(parts.length).fill(false);
      for (let i = 0; i < parts.length; i++) {
        if (consumed[i]) continue;

        // try the longest possible merge starting at i
        let matched = false;
        for (let len = parts.length - i; len >= 1; len--) {
          const candidate = parts.slice(i, i + len).join(' and '); // preserve 'and' inside candidate phrase
          // if candidate has leading number, separate it BEFORE cleaning
          const lead = candidate.match(/^\s*(\d+)\s+(.+)$/);
          const candQty = lead ? (parseInt(lead[1], 10) || 1) : extractedQty; // Use extractedQty as fallback
          let candName = lead ? lead[2].trim() : candidate;
          candName = cleanItemName(candName); // Clean command words AFTER extracting quantity

          if (candName && candName.length > 2) {
            const menuItem = findMenuItemByName(candName);
            if (menuItem) {
              results.push({ name: menuItem.name, quantity: candQty });
              for (let k = i; k < i + len; k++) consumed[k] = true;
              matched = true;
              break;
            }
          }
        }
        if (!matched) {
          // no menu match for any merge starting at i -> try single part
          const singlePart = parts[i];
          // Extract quantity from this part BEFORE cleaning
          const partLead = singlePart.match(/^\s*(\d+)\s+(.+)$/);
          const partQty = partLead ? (parseInt(partLead[1], 10) || 1) : extractedQty;
          let single = partLead ? partLead[2] : singlePart;
          single = single.replace(/[.?!]$/, '').trim();
          single = cleanItemName(single); // Clean command words AFTER extracting quantity
          
          if (single && single.length > 2) {
            const menuItem = findMenuItemByName(single);
            if (menuItem) {
              results.push({ name: menuItem.name, quantity: partQty });
            }
            // Don't add garbage to results if not found in menu
            consumed[i] = true;
          }
        }
      }

      if (results.length > 0) {
        console.log('✅ parseItemsFromText results (pattern 2):', results);
      }
      return results;
    }

    // 3) Fallback patterns for specific actions (add, remove, increase, decrease)
    // Try "add X more Y" or "add X Y" pattern
    const singleAdd = text.match(/\b(?:add)\s+(?:\b(\d+)\b\s*)?(?:more\s+)?(.+?)(?:[.?!]|$)/i);
    if (singleAdd) {
      const qty = parseInt(singleAdd[1], 10) || 1;
      let itemName = singleAdd[2].trim().replace(/[.?!]$/, '').trim();
      itemName = cleanItemName(itemName);
      
      console.log('🔍 singleAdd pattern matched - qty:', qty, 'itemName:', itemName);
      
      if (itemName && itemName.length > 2) {
        const menuItem = findMenuItemByName(itemName);
        if (menuItem) {
          console.log('✅ Found menu item:', menuItem.name, 'with qty:', qty);
          results.push({ name: menuItem.name, quantity: qty });
        }
      }
      if (results.length > 0) {
        console.log('✅ parseItemsFromText results (add pattern):', results);
      }
      return results;
    }
    
    // Try "remove X more Y" or "remove X Y" pattern
    const singleRemove = text.match(/\b(?:remove|delete)\s+(?:\b(\d+)\b\s*)?(?:more\s+)?(.+?)(?:[.?!]|$)/i);
    if (singleRemove) {
      const qty = parseInt(singleRemove[1], 10) || 1;
      let itemName = singleRemove[2].trim().replace(/[.?!]$/, '').trim();
      itemName = cleanItemName(itemName);
      
      console.log('🔍 singleRemove pattern matched - qty:', qty, 'itemName:', itemName);
      
      if (itemName && itemName.length > 2) {
        const menuItem = findMenuItemByName(itemName);
        if (menuItem) {
          console.log('✅ Found menu item for removal:', menuItem.name, 'with qty:', qty);
          results.push({ name: menuItem.name, quantity: qty, action: 'remove' });
        }
      }
      if (results.length > 0) {
        console.log('✅ parseItemsFromText results (remove pattern):', results);
      }
      return results;
    }
    
    // Try "increase X by Y" or "increase X" or "add more X" pattern
    const singleIncrease = text.match(/\b(?:increase|add\s+more)\s+(?:\b(\d+)\b\s*)?(?:more\s+)?(.+?)(?:\s+by\s+(\d+))?(?:[.?!]|$)/i);
    if (singleIncrease) {
      let itemName = singleIncrease[2].trim().replace(/[.?!]$/, '').trim();
      // Quantity can be either before item name or after "by"
      const qtyBefore = parseInt(singleIncrease[1], 10);
      const qtyAfter = parseInt(singleIncrease[3], 10);
      const qty = qtyAfter || qtyBefore || 1;
      itemName = cleanItemName(itemName);
      
      console.log('🔍 singleIncrease pattern matched - qty:', qty, 'itemName:', itemName);
      
      if (itemName && itemName.length > 2) {
        const menuItem = findMenuItemByName(itemName);
        if (menuItem) {
          console.log('✅ Found menu item for increase:', menuItem.name, 'with qty:', qty);
          results.push({ name: menuItem.name, quantity: qty, action: 'increase' });
        }
      }
      if (results.length > 0) {
        console.log('✅ parseItemsFromText results (increase pattern):', results);
      }
      return results;
    }
    
    // Try "decrease X by Y" or "decrease X" pattern  
    const singleDecrease = text.match(/\b(?:decrease|reduce|remove some)\s+(.+?)(?:\s+by\s+(\d+))?(?:[.?!]|$)/i);
    if (singleDecrease) {
      let itemName = singleDecrease[1].trim().replace(/[.?!]$/, '').trim();
      const qty = parseInt(singleDecrease[2], 10) || 1;
      itemName = cleanItemName(itemName);
      
      if (itemName && itemName.length > 2) {
        const menuItem = findMenuItemByName(itemName);
        if (menuItem) {
          results.push({ name: menuItem.name, quantity: qty, action: 'decrease' });
        }
      }
      return results;
    }
    
    console.log('⚠️ parseItemsFromText: No patterns matched, returning empty');
    return results;
  };

  if (typeof window !== 'undefined') {
    window.__parseItemsForDebug = parseItemsFromText;
  }

  // NEW: signal the rest of the app to open the menu panel (category optional)
  const openMenuPanel = (category = null) => {
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('openMenu', { detail: { category } }));
      }
    } catch (e) {
      console.warn('openMenuPanel event failed', e);
    }
  };

  const handleCategoryClick = (categoryName) => {
    // Add user message showing they clicked the category
    addMessage('user', `Show me ${categoryName}`);

    // Open the category in the menu panel instead of listing items in chat
    setTimeout(() => {
      openMenuPanel(categoryName);
      addMessage('assistant', `Opening the ${categoryName} category in the menu panel.`, null, 500);
    }, 500);
  };

  // Update the ref whenever handleUserInput changes (which depends on cartItems, etc.)
  useEffect(() => {
    handleUserInputRef.current = handleUserInput;
  }, [handleUserInput]);
  


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end justify-end p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md h-[700px] flex flex-col">
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
                {/* Add empathy indicator after the status indicator */}
                {empathyLevel === 'high' && (
                  <div className="text-xs bg-pink-500 px-2 py-0.5 rounded-full">💝 Care Mode</div>
                )}
              </div>
              <p className="text-xs opacity-90">
                {isSpeaking ? '🔊 Speaking...' :
                 isListening ? 'Listening...' : 
                 isProcessing ? 'Processing...' : 
                 isTyping ? (empathyLevel === 'high' ? 'Thinking of you' : 'Assistant is typing...') : // Update typing indicator text
                 aiServiceStatus === 'connected' ? 
                   (inputMode === 'voice' ? 'AI-powered voice mode' : 'AI-powered chat mode') :
                   (inputMode === 'voice' ? 'Voice mode (AI offline)' : 'Chat mode (AI offline)')
                }
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Voice Response Toggle */}
            <button
              onClick={() => {
                setVoiceEnabled(!voiceEnabled);
                if (voiceEnabled) {
                  stopSpeaking();
                }
              }}
              className={`text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors ${
                isSpeaking ? 'animate-pulse' : ''
              }`}
              title={voiceEnabled ? 'Voice responses enabled (click to disable)' : 'Voice responses disabled (click to enable)'}
            >
              {voiceEnabled ? (
                isSpeaking ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                  </svg>
                )
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                </svg>
              )}
            </button>
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
              <div className={`flex flex-col ${message.type === 'user' ? 'items-end' : 'items-start'}`}>
                {/* Message sender label */}
                <div className={`text-xs text-gray-500 mb-1 px-1 ${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                  {message.type === 'user' ? 'You' : 'Assistant'}
                </div>

                <div className={`max-w-[80%] rounded-lg p-3 ${message.type === 'user' ? 'bg-primary-600 text-white' : 'bg-white text-gray-800 shadow-sm border'}`}>
                  {/* If this is a receipt message, render ReceiptMessage component */}
                  {message.messageType === 'receipt' ? (
                    <div>
                      {/* Guard rendering to avoid runtime crash if receipt is malformed */}
                      { (message.menuItem || message.content) && Array.isArray((message.menuItem || message.content).items) ? (
                        /* Pass the prop name 'content' which ReceiptMessage expects */
                        <ReceiptMessage content={message.menuItem || message.content} />
                      ) : (
                         <div className="text-sm text-gray-700">Receipt unavailable. Please try again or contact support.</div>
                       )}
                    </div>
                  ) : message.messageType === 'cart_confirm' ? (
                    <div>
                      {(() => {
                        const cartContent = message.menuItem || message.content;
                        console.log('🛒 Rendering cart_confirm, cartContent:', cartContent);
                        // Guard rendering: ensure CartMessage receives the expected shape
                        if (cartContent && cartContent.items && Array.isArray(cartContent.items) && cartContent.items.length > 0) {
                          return <CartMessage content={cartContent} />;
                        }
                        // Fallback UI if cart/receipt is missing or empty (prevents crashes)
                        return (
                          <div className="text-sm text-gray-700">
                            Your cart is empty. Please add items before placing an order.
                          </div>
                        );
                      })()}
                      {(() => {
                        const cartContent = message.menuItem || message.content;
                        // Only show buttons if cart has items
                        if (cartContent && cartContent.items && Array.isArray(cartContent.items) && cartContent.items.length > 0) {
                          return (
                            <div className="mt-3 flex space-x-2">
                              <button
                                type="button"
                                onClick={handleConfirmPlaceOrder}
                                disabled={isProcessing}
                                className="px-3 py-2 bg-green-600 text-white rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Yes — place order
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelPlaceOrder}
                                className="px-3 py-2 bg-gray-200 text-gray-800 rounded-md text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  ) : (
                    <>
                      {/* Regular text message */}
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                      {/* Menu item preview for assistant messages */}
                      {message.type === 'assistant' && message.menuItem && message.messageType === 'text' && (
                        <div className="mt-3 p-3 bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg border-l-4 border-primary-600">
                          <div className="flex items-center space-x-3">
                            <div className="flex-1">
                              <p className="font-semibold text-sm text-gray-800">{message.menuItem.name}</p>
                              <p className="text-primary-600 font-bold text-sm">${message.menuItem.price}</p>
                            </div>
                            <div className="text-green-500">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
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
          
          {/* Speaking indicator */}
          {isSpeaking && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg p-3 bg-blue-50 text-blue-800 shadow-sm border-2 border-blue-200">
                <div className="flex items-center space-x-2">
                  <span className="text-sm">🔊 Speaking...</span>
                  <div className="flex space-x-1">
                    <div className="w-1 h-3 bg-blue-600 rounded-full animate-pulse"></div>
                    <div className="w-1 h-4 bg-blue-600 rounded-full animate-pulse" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-1 h-5 bg-blue-600 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-1 h-4 bg-blue-600 rounded-full animate-pulse" style={{animationDelay: '0.3s'}}></div>
                    <div className="w-1 h-3 bg-blue-600 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
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
                
                {/* Stop Speaking Button */}
                {isSpeaking && (
                  <button
                    onClick={stopSpeaking}
                    className="w-12 h-12 rounded-full flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white shadow-lg transition-all transform hover:scale-105"
                    title="Stop speaking"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 6h12v12H6z"/>
                    </svg>
                  </button>
                )}
              </div>
              
              <p className="text-center text-sm text-gray-600 mt-2">
                {isSpeaking ? 'Assistant is speaking (tap square to stop)' :
                 isListening ? 'Listening to your order...' : 
                 isProcessing ? 'Processing your request...' : 
                 'Tap to speak your order'}
              </p>
              
              {/* Voice response status */}
              <div className="text-center mt-2">
                <span className={`text-xs ${voiceEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                  {voiceEnabled ? '🔊 Voice responses ON' : '🔇 Voice responses OFF'}
                </span>
              </div>
              
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
