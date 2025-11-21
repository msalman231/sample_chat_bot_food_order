import os
import re
import json
import time
import random
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from dotenv import load_dotenv
from pydantic import SecretStr
from typing import List, Dict, Optional, Any

# Load environment variables from .env file
load_dotenv()

# GraphQL configuration
GRAPHQL_URL = "http://localhost:4000/graphql"

# Global variables for menu data
MENU_ITEMS = []
MENU_CATEGORIES = []
MENU_DATA_CACHE = {}
LAST_FETCH_TIME = 0
CACHE_DURATION = 300  # 5 minutes in seconds

def fetch_menu_data_from_graphql() -> Optional[Dict[str, Any]]:
    """Fetch menu items and categories from GraphQL server"""
    global LAST_FETCH_TIME, MENU_DATA_CACHE
    
    # Check if cache is still valid
    current_time = time.time()
    if current_time - LAST_FETCH_TIME < CACHE_DURATION and MENU_DATA_CACHE:
        print("📋 Using cached menu data")
        return MENU_DATA_CACHE
    
    query = """
    query {
        menuItems {
            id
            name
            description
            price
            category
            available
            ingredients
        }
    }
    """
    
    try:
        print("[INFO] Fetching menu data from GraphQL...")
        response = requests.post(
            GRAPHQL_URL,
            json={'query': query},
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if 'data' in data and 'menuItems' in data['data']:
                menu_items = data['data']['menuItems']
                
                # Cache the data
                MENU_DATA_CACHE = {
                    'items': menu_items,
                    'categories': list(set(item['category'] for item in menu_items if item['available']))
                }
                LAST_FETCH_TIME = current_time
                
                print(f"[SUCCESS] Fetched {len(menu_items)} menu items from GraphQL")
                print(f"[INFO] Categories: {MENU_DATA_CACHE['categories']}")
                
                return MENU_DATA_CACHE
            else:
                print("[ERROR] Invalid GraphQL response structure")
                return None
        else:
            print(f"[ERROR] GraphQL request failed with status {response.status_code}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Error connecting to GraphQL server: {e}")
        return None
    except Exception as e:
        print(f"[ERROR] Error fetching menu data: {e}")
        return None

def update_menu_items_from_graphql():
    """Update global MENU_ITEMS and MENU_CATEGORIES from GraphQL data"""
    global MENU_ITEMS, MENU_CATEGORIES
    
    menu_data = fetch_menu_data_from_graphql()
    if menu_data:
        # Update menu items list (only available items)
        MENU_ITEMS = [
            item['name'] for item in menu_data['items'] 
            if item['available']
        ]
        
        # Update categories
        MENU_CATEGORIES = menu_data['categories']
        
        print(f"🔄 Updated menu: {len(MENU_ITEMS)} items across {len(MENU_CATEGORIES)} categories")
        return True
    else:
        # Fallback to static menu if GraphQL is unavailable
        print("⚠️  Using fallback static menu data")
        MENU_ITEMS = [
            "Margherita Pizza", "Pepperoni Pizza", "BBQ Chicken Pizza", "Veggie Supreme Pizza",
            "Caesar Salad", "Greek Salad", "Garden Salad", "Chicken Caesar Salad",
            "Spaghetti Carbonara", "Penne Arrabbiata", "Fettuccine Alfredo", "Lasagna",
            "Grilled Salmon", "Grilled Shrimp", "Fish and Chips", "Seafood Platter",
            "Grilled Chicken Breast", "Beef Burger", "Veggie Burger", "Steak",
            "Garlic Bread", "Mozzarella Sticks", "Chicken Wings", "Onion Rings", "Bruschetta",
            "Chocolate Cake", "Tiramisu", "Ice Cream", "Cheesecake",
            "Coca Cola", "Pepsi", "Orange Juice", "Apple Juice", "Water", "Coffee", "Tea"
        ]
        MENU_CATEGORIES = ["Pizza", "Pasta", "Salads", "Seafood", "Main Courses", "Appetizers", "Desserts", "Beverages"]
        return False

def get_menu_item_details(item_name: str) -> Optional[Dict]:
    """Get detailed information about a menu item from GraphQL data"""
    menu_data = fetch_menu_data_from_graphql()
    if menu_data:
        for item in menu_data['items']:
            if item['name'].lower() == item_name.lower() and item['available']:
                return item
    return None

def find_menu_item_fuzzy_with_details(search_term: str) -> Optional[Dict]:
    """Find menu item with fuzzy matching and return full details"""
    search_term = search_term.lower().strip()
    menu_data = fetch_menu_data_from_graphql()
    
    if not menu_data:
        # Fallback to simple name matching
        matched_name = find_menu_item_fuzzy(search_term)
        return {'name': matched_name, 'price': 12.99} if matched_name else None
    
    # Exact match first
    for item in menu_data['items']:
        if item['available'] and item['name'].lower() == search_term:
            return item
    
    # Partial match (search term in menu item)
    for item in menu_data['items']:
        if item['available'] and search_term in item['name'].lower():
            return item
    
    # Reverse partial match (menu item in search term)
    for item in menu_data['items']:
        if item['available'] and item['name'].lower() in search_term:
            return item
    
    # Space-normalized match
    search_normalized = search_term.replace(' ', '')
    for item in menu_data['items']:
        if item['available']:
            item_normalized = item['name'].lower().replace(' ', '')
            if search_normalized == item_normalized:
                return item
    
    # Common variations and synonyms with GraphQL data
    synonyms = {
        'apple juice can': 'Apple Juice Can',
        'fresh orange juice': 'Fresh Orange Juice',
        'water bottle': 'Water Bottle',
        'coke': 'Coca Cola',
        'pepsi cola': 'Pepsi',
        'orange': 'Fresh Orange Juice',
        'apple': 'Apple Juice Can'
    }
    
    if search_term in synonyms:
        synonym_name = synonyms[search_term]
        for item in menu_data['items']:
            if item['available'] and item['name'].lower() == synonym_name.lower():
                return item
    
    return None

app = Flask(__name__)
CORS(app)

# Initialize menu data from GraphQL on startup
print("Initializing menu data from GraphQL...")
update_menu_items_from_graphql()

# 🔑 API key configuration
# Check if API key is properly configured
if os.environ.get("OPENAI_API_KEY", "your-openai-api-key-here") == "your-openai-api-key-here":
    print("Warning: OpenAI API key is not configured!")
    print("Please set OPENAI_API_KEY environment variable")
    print("Get your API key from: https://platform.openai.com/api-keys")
    
try:
    # Use GitHub's OpenAI API if base URL is provided
    base_url = os.getenv("OPENAI_BASE_URL")
    api_key = os.getenv("GITHUB_TOKEN") or os.getenv("OPENAI_API_KEY")
    
    # Only initialize llm if we have an API key
    if api_key and api_key != "your-openai-api-key-here":
        # Note: There are type checking issues with SecretStr, but the functionality works
        # For GitHub Models, use the model name without the "openai/" prefix
        model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        if model_name.startswith("openai/"):
            model_name = model_name.replace("openai/", "")
        
        llm = ChatOpenAI(
            model=model_name,
            temperature=float(os.getenv("OPENAI_TEMPERATURE", "0.2")),
            base_url=base_url,
            api_key=api_key  # Type checking issue here, but functionality works
        )
    else:
        llm = None
        print("OpenAI API key not provided, running in fallback mode")
except Exception as e:
    print(f"Error initializing OpenAI client: {e}")
    llm = None

# Store conversation sessions
conversations = {}

def find_menu_item_fuzzy(search_term):
    """Find menu item with fuzzy matching and return best match (legacy compatibility)"""
    result = find_menu_item_fuzzy_with_details(search_term)
    return result['name'] if result else None

def clean_response_formatting(text):
    """Clean up markdown and asterisk formatting from AI responses"""
    if not text:
        return text
    
    # Remove markdown formatting
    cleaned = re.sub(r'\*\*(.*?)\*\*', r'\1', text)  # Remove bold **text**
    cleaned = re.sub(r'\*(.*?)\*', r'\1', cleaned)    # Remove italic *text*
    cleaned = re.sub(r'#{1,6}\s*', '', cleaned)       # Remove headers ###
    cleaned = re.sub(r'```[^`]*```', '', cleaned)     # Remove code blocks
    cleaned = re.sub(r'`([^`]*)`', r'\1', cleaned)    # Remove inline code
    cleaned = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', cleaned)  # Remove links
    
    # Clean up excessive asterisks and special chars
    cleaned = re.sub(r'\*{2,}', '', cleaned)          # Remove multiple asterisks
    cleaned = re.sub(r'\*\s*\*', '', cleaned)         # Remove spaced asterisks
    cleaned = re.sub(r'^\s*\*\s*', '', cleaned, flags=re.MULTILINE)  # Remove line-starting asterisks
    
    # Clean up extra whitespace
    cleaned = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned)  # Max 2 consecutive newlines
    cleaned = re.sub(r'\s+', ' ', cleaned)            # Multiple spaces to single
    cleaned = cleaned.strip()
    
    return cleaned

def _make_human_comment_for_item(item: Dict[str, Any], emotional_state: Dict = None) -> str:
    """Create a short human-like positive comment for a menu item, adapted for emotional state."""
    if not item:
        return "A great choice — many customers love this!"
    
    category = item.get('category', '').lower()
    emotion = emotional_state.get('emotion', 'neutral') if emotional_state else 'neutral'
    
    # Emotional context-based comments
    if emotion in ['very_negative', 'negative', 'crisis']:
        if 'dessert' in category:
            return "Sometimes a little sweetness can bring comfort during tough times. This is especially loved by customers."
        elif 'pizza' in category:
            return "Warm, cheesy comfort food that feels like a hug. Many find this particularly soothing."
        elif 'pasta' in category:
            return "Warm, hearty, and comforting — like a bowl of love. Perfect for difficult days."
        elif 'beverage' in category and ('tea' in item.get('name', '').lower() or 'coffee' in item.get('name', '').lower()):
            return "Warm and soothing — sometimes a comforting drink is exactly what we need."
        elif 'salad' in category:
            return "Fresh and nourishing — taking care of yourself with good food is important."
    
    elif emotion == 'lonely':
        if 'pizza' in category:
            return "Perfect for enjoying while watching something comforting — you're not alone."
        elif 'dessert' in category:
            return "A little treat for yourself because you deserve something sweet."
        else:
            return "A wonderful choice to enjoy — I hope it brings you some warmth."
    
    elif emotion == 'unwell':
        if 'beverage' in category:
            return "Gentle and soothing — perfect when you're not feeling your best."
        elif 'salad' in category:
            return "Light and nourishing — easy on the stomach when you're recovering."
        elif 'pasta' in category:
            return "Comforting and easy to digest — great for when you need gentle nourishment."
    
    elif emotion in ['positive', 'celebratory']:
        if 'dessert' in category:
            return "Perfect for celebrating! Life's good moments deserve something sweet."
        elif 'pizza' in category:
            return "Excellent choice for a great day — enjoy every delicious bite!"
        else:
            return "Fantastic pick for someone in such a great mood!"
    
    # Original logic for neutral emotional state
    desc = item.get('description') or (', '.join(item.get('ingredients', [])) if item.get('ingredients') else '')
    if desc:
        first_sentence = desc.split('.')[0].strip()
        if first_sentence:
            return f"{first_sentence.capitalize()}. A popular pick!"
    
    # Category-based fallback
    if 'pizza' in category:
        return "Cheesy, flavorful and perfect to share — a crowd favorite!"
    if 'salad' in category:
        return "Fresh and crisp — great if you're craving something light."
    if 'dessert' in category:
        return "Sweet finish — customers often save room for this."
    if 'seafood' in category:
        return "Delicately seasoned and cooked to perfection."
    if 'beverage' in category:
        return "Refreshing and pairs well with meals."
    
    return "A tasty choice — many customers enjoy this!"

def detect_emotional_state(user_message):
    """Detect user's emotional state with intensity and specific emotions"""
    lower_message = user_message.lower()
    
    # Comprehensive emotional vocabulary
    emotional_indicators = {
        'very_negative': {
            'keywords': ['devastated', 'destroyed', 'ruined', 'hopeless', 'suicide', 'kill myself', 'end it all', 'can\'t take it', 'hate my life', 'want to die'],
            'intensity': 'very_high',
            'emotion': 'crisis'
        },
        'negative_high': {
            'keywords': ['worst day ever', 'horrible', 'terrible', 'awful', 'miserable', 'depressed', 'devastated', 'heartbroken', 'furious', 'livid'],
            'intensity': 'high',
            'emotion': 'very_negative'
        },
        'negative_medium': {
            'keywords': ['sad', 'upset', 'angry', 'frustrated', 'disappointed', 'stressed', 'worried', 'anxious', 'down', 'blue', 'tired', 'exhausted'],
            'intensity': 'medium',
            'emotion': 'negative'
        },
        'negative_low': {
            'keywords': ['bad day', 'not great', 'could be better', 'meh', 'okay i guess', 'not feeling it', 'bit down'],
            'intensity': 'low',
            'emotion': 'slightly_negative'
        },
        'positive': {
            'keywords': ['happy', 'great', 'awesome', 'fantastic', 'wonderful', 'excited', 'amazing', 'perfect', 'love', 'best day'],
            'intensity': 'high',
            'emotion': 'positive'
        },
        'celebratory': {
            'keywords': ['celebrating', 'birthday', 'anniversary', 'promotion', 'got the job', 'engaged', 'married', 'graduation'],
            'intensity': 'high',
            'emotion': 'celebratory'
        },
        'lonely': {
            'keywords': ['alone', 'lonely', 'no one cares', 'by myself', 'isolated', 'no friends', 'nobody understands'],
            'intensity': 'medium',
            'emotion': 'lonely'
        },
        'sick': {
            'keywords': ['sick', 'ill', 'not feeling well', 'under the weather', 'flu', 'cold', 'fever', 'headache'],
            'intensity': 'medium',
            'emotion': 'unwell'
        }
    }
    
    detected_emotions = []
    for category, data in emotional_indicators.items():
        for keyword in data['keywords']:
            if keyword in lower_message:
                detected_emotions.append({
                    'category': category,
                    'keyword': keyword,
                    'intensity': data['intensity'],
                    'emotion': data['emotion']
                })
    
    # Return the most intense emotion found, or neutral
    if detected_emotions:
        # Sort by intensity priority
        intensity_order = {'very_high': 4, 'high': 3, 'medium': 2, 'low': 1}
        detected_emotions.sort(key=lambda x: intensity_order.get(x['intensity'], 0), reverse=True)
        return detected_emotions[0]
    
    return {'emotion': 'neutral', 'intensity': 'none', 'category': 'neutral'}

def generate_empathetic_response(emotional_state, user_name=None, context='greeting'):
    """Generate appropriate empathetic responses based on emotional state"""
    emotion = emotional_state.get('emotion', 'neutral')
    intensity = emotional_state.get('intensity', 'none')
    
    name_prefix = f"{user_name}, " if user_name else ""
    
    if emotion == 'crisis':
        return f"I'm deeply concerned about you, {name_prefix}and I want you to know that you matter. Please consider reaching out to someone you trust or a mental health professional. In the meantime, let me help you with some comfort food - sometimes a warm meal can provide a small moment of comfort during difficult times."
    
    elif emotion == 'very_negative':
        responses = [
            f"I'm so sorry you're going through such a tough time, {name_prefix}My heart goes out to you. Would you like me to suggest something particularly comforting from our menu? Sometimes a favorite dish can bring a tiny bit of warmth to a difficult day.",
            f"That sounds incredibly hard, {name_prefix}I wish I could give you a hug right now. Let me at least help you with some soul-warming food. What usually brings you comfort when you're feeling this way?"
        ]
        return random.choice(responses)
    
    elif emotion == 'negative' and intensity == 'high':
        responses = [
            f"I can hear that you're really struggling right now, {name_prefix}I'm here for you. Would you like me to recommend something especially comforting? Sometimes the right meal can be a small act of self-care.",
            f"I'm really sorry you're having such a difficult time, {name_prefix}You deserve some kindness, especially from yourself. Let me help you find something delicious that might brighten your day just a little."
        ]
        return random.choice(responses)
    
    elif emotion == 'negative':
        responses = [
            f"I'm sorry you're not feeling your best today, {name_prefix}I hope I can help make things a little better. What sounds good to you right now?",
            f"I can sense you're having a rough time, {name_prefix}Let me help you find something that might lift your spirits. What kind of flavors usually comfort you?"
        ]
        return random.choice(responses)
    
    elif emotion == 'slightly_negative':
        responses = [
            f"I hope your day gets better, {name_prefix}Sometimes a good meal can help turn things around. What are you in the mood for?",
            f"Sorry to hear things aren't going great, {name_prefix}Let's find you something delicious to help improve your day!"
        ]
        return random.choice(responses)
    
    elif emotion == 'lonely':
        responses = [
            f"You're not alone right now, {name_prefix}I'm here with you, and I care about making sure you get something wonderful to eat. Tell me what sounds good?",
            f"I'm glad you're here with me, {name_prefix}Let's find you something special. Sometimes sharing a meal (even virtually) can feel less lonely."
        ]
        return random.choice(responses)
    
    elif emotion == 'unwell':
        responses = [
            f"Oh no, I hope you feel better soon, {name_prefix}When you're not feeling well, it's important to nourish yourself. Would you like something light and comforting, or something more substantial?",
            f"I'm sorry you're not feeling well, {name_prefix}Let me help you find something gentle on the stomach but still delicious. What usually helps when you're under the weather?"
        ]
        return random.choice(responses)
    
    elif emotion == 'positive':
        responses = [
            f"I love your positive energy, {name_prefix}It's wonderful to chat with someone who's having a great day! What delicious food would make your day even better?",
            f"Your happiness is contagious, {name_prefix}Let's celebrate your good mood with some amazing food! What are you craving?"
        ]
        return random.choice(responses)
    
    elif emotion == 'celebratory':
        responses = [
            f"Congratulations, {name_prefix}That's fantastic news! This calls for something special. What would make this celebration perfect?",
            f"How exciting, {name_prefix}I'm so happy for you! Let's make this celebration delicious. What's your favorite way to treat yourself?"
        ]
        return random.choice(responses)
    
    else:  # neutral
        if user_name:
            return f"Hello, {user_name}! I'm here to help you find something delicious. How are you feeling today?"
        else:
            return "Hello! I'm here to help you with your order. How are you doing today?"

def detect_intent_and_create_action(user_message, response_text):
    """Detect user intent and create appropriate action when JSON parsing fails"""
    lower_message = user_message.lower()
    
    print(f"🔍 Analyzing message: '{user_message}'")
    
    # --- EMPATHETIC GREETING WITH EMOTIONAL INTELLIGENCE ---
    if any(greet in lower_message for greet in ['hi', 'hello', 'hey', 'hiya', 'good morning', 'good afternoon', 'good evening', 'yo']):
        # Extract name if present
        name_match = re.search(r'^(?:hi|hello|hey|hiya|yo|good morning|good afternoon|good evening)[,!\s]*(?:i\'m\s+|i am\s+|here[,!\s]*|my name is\s+)?([A-Za-z][A-Za-z\-]{0,30})', user_message, re.IGNORECASE)
        name = name_match.group(1).strip().capitalize() if name_match else None
        
        # Detect emotional state
        emotional_state = detect_emotional_state(user_message)
        
        # Generate empathetic response
        response_text = generate_empathetic_response(emotional_state, name, 'greeting')
        
        return {
            "action": "greeting",
            "message_type": "text",
            "greeting_name": name,
            "emotional_state": emotional_state,
            "response_text": response_text,
            "response_delay": 800
        }
    # --- end empathetic greeting detection ---

    # Detect clear chat commands FIRST
    if any(phrase in lower_message for phrase in ['clear chat', 'clear conversation', 'reset chat', 'start over', 'new conversation']):
        return {
            "action": "clear_chat",
            "message_type": "text",
            "response_delay": 500
        }
    
    # Detect cart-related commands
    if any(phrase in lower_message for phrase in ['show my cart', 'show cart', 'view cart', 'my cart', 'cart contents', 'what\'s in my cart']):
        return {
            "action": "show_cart",
            "message_type": "text",
            "response_delay": 1000
        }
    
    # PRIORITY 1: Detect REMOVE ALL commands first (before other patterns)
    # Enhanced remove all patterns with better specificity
    remove_all_patterns = [
        # "Remove all [item]" or "Remove all [item] from cart"
        r'\b(?:remove|delete|cancel|take\s+out)\s+all\s+([a-zA-Z\s]+?)(?:\s+from\s+cart)?(?:\s|$)',
        # "Remove all of [item]" or "Remove all of [item] from cart"
        r'\b(?:remove|delete|cancel|take\s+out)\s+all\s+of\s+([a-zA-Z\s]+?)(?:\s+from\s+cart)?(?:\s|$)'
    ]
    
    for pattern in remove_all_patterns:
        remove_all_match = re.search(pattern, lower_message, re.IGNORECASE)
        if remove_all_match:
            item_name = remove_all_match.group(1).strip()
            print(f"🗑️ Remove ALL detected: '{item_name}'")
            
            # Find the exact menu item
            item_details = find_menu_item_fuzzy_with_details(item_name)
            if item_details:
                print(f"✅ Found item to remove all: '{item_details['name']}'")
                return {
                    "action": "remove_all",
                    "message_type": "text",
                    "target_item": item_details['name'],
                    "response_delay": 1000
                }
            else:
                print(f"❌ Item not found for remove all: '{item_name}'")
    
    # PRIORITY 2: Detect REMOVE commands (with quantities)
    # Enhanced remove patterns with better specificity - order matters!
    remove_patterns = [
        # "Remove the [quantity] quantity of [item]" or "Remove [quantity] quantity of [item]" (MOST SPECIFIC FIRST)
        r'\b(?:remove|delete)\s+(?:the\s+)?(\d+)\s+quantity\s+of\s+([a-zA-Z\s]+?)(?:\s|$)',
        # "Remove [item] by [quantity]"
        r'\b(?:remove|delete)\s+([a-zA-Z\s]+?)\s+by\s+(\d+)\b',
        # "Remove [quantity] [item]" (but not if it's "quantity of") - GREEDY match for full item names
        r'\b(?:remove|delete|cancel|take\s+out)\s+(\d+)\s+(?!quantity\s+of)(.+?)(?:\s*$)',
        # "Remove the [item]" (with "the" prefix, no quantity)
        r'\b(?:remove|delete|cancel)\s+the\s+([a-zA-Z\s]+?)(?:\s+from\s+cart)?(?:\s|$)',
        # "Remove [item]" (simple form, no quantity, no "the") - GREEDY match
        r'\b(?:remove|delete|cancel)\s+(.+?)(?:\s+from\s+cart)?(?:\s*$)',
        # "Take out [quantity] [item]" - GREEDY match
        r'\btake\s+out\s+(?:(\d+)\s+)?(.+?)(?:\s*$)'
    ]
    
    for pattern in remove_patterns:
        remove_match = re.search(pattern, lower_message, re.IGNORECASE)
        if remove_match:
            print(f"🗑️ Remove pattern matched: '{pattern}' with groups: {remove_match.groups()}")
            
            # Handle different pattern formats based on the pattern structure
            if 'quantity\\s+of' in pattern:
                # Pattern: "remove [quantity] quantity of [item]"
                quantity = int(remove_match.group(1))
                item_name = remove_match.group(2).strip()
            elif 'by' in pattern:
                # Pattern: "remove [item] by [quantity]"
                item_name = remove_match.group(1).strip()
                quantity = int(remove_match.group(2))
            elif '(\\d+)\\s+(?!quantity\\s+of)(.+?)' in pattern:
                # Pattern: "remove [quantity] [item]" (new greedy pattern)
                quantity = int(remove_match.group(1))
                item_name = remove_match.group(2).strip()
            elif 'take\\s+out' in pattern and len(remove_match.groups()) == 2:
                # Pattern: "take out [quantity] [item]"
                quantity_str = remove_match.group(1)
                item_name = remove_match.group(2).strip()
                quantity = int(quantity_str) if quantity_str else 1
            else:
                # Simple patterns: "remove [item]" or "remove the [item]"
                item_name = remove_match.group(1).strip() if remove_match.group(1) else ""
                quantity = 1
            
            print(f"🗑️ Remove detected: '{item_name}' (quantity: {quantity})")
            
            # Find the exact menu item
            item_details = find_menu_item_fuzzy_with_details(item_name)
            if item_details:
                print(f"✅ Found item to remove: '{item_details['name']}'")
                # Always use "update" action for quantity-based removal
                return {
                    "action": "update",
                    "message_type": "text",
                    "operation": "decrease",
                    "target_item": item_details['name'],
                    "quantity": quantity,
                    "response_delay": 1000
                }
            else:
                print(f"❌ Item not found for removal: '{item_name}'")
    
    # PRIORITY 3: Detect DECREASE commands (before add patterns)
    decrease_patterns = [
        r'\b(?:decrease|reduce)\s+([a-zA-Z\s]+?)\s+(?:by\s+)?(\d+)\b',
        r'\b(?:decrease|reduce)\s+(?:the\s+)?([a-zA-Z\s]+?)\s+(?:by\s+)?(\d+)\b'
    ]
    
    for pattern in decrease_patterns:
        decrease_match = re.search(pattern, lower_message, re.IGNORECASE)
        if decrease_match:
            item_name = decrease_match.group(1).strip()
            quantity = int(decrease_match.group(2))
            
            print(f"⬇️ Decrease detected: '{item_name}' by {quantity}")
            
            # Find the exact menu item
            item_details = find_menu_item_fuzzy_with_details(item_name)
            if item_details:
                print(f"✅ Found item to decrease: '{item_details['name']}'")
                return {
                    "action": "update",
                    "message_type": "text",
                    "operation": "decrease",
                    "target_item": item_details['name'],
                    "quantity": quantity,
                    "response_delay": 1000
                }
            else:
                print(f"❌ Item not found for decrease: '{item_name}'")
    
    # PRIORITY 4: Detect INCREASE/ADD MORE commands
    increase_patterns = [
        # "Add [quantity] more [item]"
        r'\b(?:add)\s+(?:(\d+)\s+)?(?:more)\s+([a-zA-Z\s]+?)(?:\s|$)',
        # "Increase [item] by [quantity]"
        r'\b(?:increase)\s+([a-zA-Z\s]+?)\s+(?:by\s+)?(\d+)\b',
        # "Add more [item]"
        r'\b(?:add)\s+(?:more)\s+([a-zA-Z\s]+?)(?:\s|$)'
    ]
    
    for pattern in increase_patterns:
        increase_match = re.search(pattern, lower_message, re.IGNORECASE)
        if increase_match:
            if len(increase_match.groups()) == 2 and increase_match.group(2):
                if 'by' in pattern:
                    item_name = increase_match.group(1).strip()
                    quantity = int(increase_match.group(2))
                else:
                    quantity_str = increase_match.group(1)
                    item_name = increase_match.group(2).strip()
                    quantity = int(quantity_str) if quantity_str else 1
            else:
                item_name = increase_match.group(1).strip()
                quantity = 1
            
            print(f"⬆️ Increase detected: '{item_name}' by {quantity}")
            
            return {
                "action": "update",
                "message_type": "text",
                "operation": "increase",
                "target_item": item_name,
                "quantity": quantity,
                "response_delay": 1000
            }
    
    # Check if "I want to order" is followed by specific items/quantities
    # This should be processed as multi-category, not order placement
    if "i want to order" in lower_message:
        # Extract everything after "i want to order"
        order_match = re.search(r'i\s+want\s+to\s+order\s+(.+)', lower_message)
        if order_match:
            order_content = order_match.group(1)
            # Check if it contains quantities and categories (not empty order)
            has_quantities = bool(re.search(r'\d+\s+(?:pizza|pasta|salad|dessert|beverage|seafood|appetizer|main)', order_content))
            if has_quantities:
                # Process as multi-category order, continue to multi-category detection
                pass
            else:
                # Empty "I want to order" - treat as order placement
                return {
                    "action": "place_order",
                    "message_type": "text",
                    "order_id": f"ORD-{int(time.time())}",
                    "response_delay": 1500
                }
    
    # Detect order placement commands (only when no quantities/items specified)
    order_placement_phrases = ['place order', 'place my order', 'order this', 'checkout', 'order now', 'complete order', 'proceed with order']
    if any(phrase in lower_message for phrase in order_placement_phrases):
        # Ask for explicit confirmation in the UI before placing
        return {
            "action": "place_order",
            "message_type": "text",
            "response_text": "Would you like to proceed to place your order?",
            "response_delay": 300
        }

    # PRIORITY 5: Detect direct item addition (but avoid conflicts with remove/decrease)
    # Enhanced patterns to avoid matching remove/decrease commands
    direct_item_patterns = [
        # Pattern 1: "Add [quantity] [item name]" (not "add more")
        r'\b(?:add)\s+(?!more\b)(\d+)\s+([a-zA-Z\s]+?)(?:\s|$)',
        # Pattern 2: "Add [item name]" (not "add more")
        r'\b(?:add)\s+(?!more\b)(?!\d+\s+more\b)([a-zA-Z\s]+?)(?:\s|$)',
        # Pattern 3: "I want [quantity] of [item name]" or "I want [quantity] [item name]"
        r'\bi\s+want\s+(?!(to\s+order\s*$))(\d+)\s+(?:of\s+)?([a-zA-Z\s]+?)(?:\s|$)',
        # Pattern 4: "I want [item name]" (not empty order)
        r'\bi\s+want\s+(?!(to\s+order\s*$))(?!\d+\s+)([a-zA-Z\s]+?)(?:\s|$)',
        # Pattern 5: "Get me [quantity] [item name]"
        r'\bget\s+me\s+(\d+)\s+([a-zA-Z\s]+?)(?:\s|$)',
        # Pattern 6: "Get me [item name]"
        r'\bget\s+me\s+(?!\d+\s+)([a-zA-Z\s]+?)(?:\s|$)',
        # Pattern 7: "Order [quantity] [item name]"
        r'\border\s+(\d+)\s+([a-zA-Z\s]+?)(?:\s|$)',
        # Pattern 8: "Order [item name]"
        r'\border\s+(?!\d+\s+)([a-zA-Z\s]+?)(?:\s|$)'
    ]
    
    # Detect multi-category bulk orders FIRST (more specific patterns)
    # Enhanced to catch phrases like "I want Quantity [category] with more 2 items"
    multi_category_pattern = r'\b(?:i\s+want(?:\s+to\s+order)?|get\s+me|order|quantity)\s+(.+?)\s*$'
    multi_match = re.search(multi_category_pattern, lower_message)
    
    if multi_match:
        order_text = multi_match.group(1)
        categories = []
        
        # Enhanced patterns for multi-category detection
        # Added pattern to catch "Quantity [category] with more [number] items"
        quantity_category_patterns = [
            (r'(\d+)\s+(pizza|pizzas)', 'Pizza'),
            (r'(\d+)\s+(pasta|pastas)', 'Pasta'),
            (r'(\d+)\s+(salad|salads)', 'Salads'),
            (r'(\d+)\s+(dessert|desserts)', 'Desserts'),
            (r'(\d+)\s+(beverage|beverages|drink|drinks)', 'Beverages'),
            (r'(\d+)\s+(appetizer|appetizers|starter|starters)', 'Appetizers'),
            (r'(\d+)\s+(main\s+course|main\s+courses|entree|entrees)', 'Main Courses'),
            (r'(\d+)\s+(seafood)', 'Seafood')
        ]
        
        for pattern, category in quantity_category_patterns:
            matches = re.findall(pattern, order_text)
            for match in matches:
                quantity = int(match[0])
                categories.append({"category": category, "quantity": quantity})
        
        # Handle special pattern: "Quantity [category] with more [number] items"
        special_pattern = r'(?:quantity\s+)?([a-zA-Z]+)\s+with\s+more\s+(\d+)'
        special_matches = re.findall(special_pattern, order_text, re.IGNORECASE)
        for match in special_matches:
            category_name = match[0].lower()
            quantity = int(match[1])
            # Map common category names to proper category names
            category_mapping = {
                'pizza': 'Pizza', 'pizzas': 'Pizza',
                'pasta': 'Pasta', 'pastas': 'Pasta',
                'salad': 'Salads', 'salads': 'Salads',
                'dessert': 'Desserts', 'desserts': 'Desserts',
                'beverage': 'Beverages', 'beverages': 'Beverages', 'drink': 'Beverages', 'drinks': 'Beverages',
                'appetizer': 'Appetizers', 'appetizers': 'Appetizers', 'starter': 'Appetizers', 'starters': 'Appetizers',
                'main': 'Main Courses', 'main course': 'Main Courses', 'main courses': 'Main Courses', 'entree': 'Main Courses', 'entrees': 'Main Courses',
                'seafood': 'Seafood'
            }
            mapped_category = category_mapping.get(category_name.lower(), category_name.capitalize())
            categories.append({"category": mapped_category, "quantity": quantity})
        
        # If multiple categories detected, return multi-category action
        if len(categories) > 1:
            return {
                "action": "multi_category_bulk",
                "message_type": "text",
                "multi_categories": categories,
                "current_category_index": 0,
                "response_delay": 1500
            }
        
        # If single category with quantity 2+, return bulk menu
        elif len(categories) == 1:
            category_data = categories[0]
            return {
                "action": "bulk_menu",
                "message_type": "text",
                "category": category_data["category"],
                "bulk_quantity": category_data["quantity"],
                "response_delay": 1500
            }
    
    # Check for multiple items in a single command (e.g., "Add 2 Margherita Pizza and 3 Tiramisu")
    # Only check if not a remove/decrease command
    if not any(word in lower_message for word in ['remove', 'delete', 'decrease', 'reduce', 'take out']):
        # More specific pattern to avoid conflicts with multi-category orders
        multiple_items_pattern = r'\b(?:add|i\s+want|get\s+me|order)\s+(\d+\s+[a-zA-Z\s]+?(?:\s+and\s+\d+\s+[a-zA-Z\s]+?)+)'
        multiple_match = re.search(multiple_items_pattern, lower_message, re.IGNORECASE)
        
        if multiple_match:
            full_order_text = multiple_match.group(1)
            print(f"🔍 Multiple items detected in: '{full_order_text}'")
            
            # Detect emotional state for personalized processing
            emotional_state = detect_emotional_state(user_message)
            
            # Split by 'and' to find multiple items
            if ' and ' in full_order_text:
                item_parts = [part.strip() for part in full_order_text.split(' and ')]
                detected_items = []
                not_found_items = []
                
                print(f"📋 Processing {len(item_parts)} item parts: {item_parts}")
                
                for part in item_parts:
                    # Extract quantity and item name from each part
                    item_match = re.search(r'^(?:(\d+)\s+)?(?:of\s+)?(.+)$', part.strip(), re.IGNORECASE)
                    if item_match:
                        quantity_str = item_match.group(1)
                        item_name = item_match.group(2).strip()
                        quantity = int(quantity_str) if quantity_str else 1
                        
                        print(f"🔎 Looking for item: '{item_name}' (quantity: {quantity})")
                        
                        # Use fuzzy matching to find the exact menu item with details
                        item_details = find_menu_item_fuzzy_with_details(item_name)
                        
                        if item_details:
                            print(f"✅ Found: '{item_name}' → '{item_details['name']}'")
                            detected_items.append({
                                "name": item_details['name'],
                                "quantity": quantity,
                                "price": item_details.get('price', 12.99),
                                "id": item_details.get('id', f"item-{len(detected_items)+1}"),
                                "human_comment": _make_human_comment_for_item(item_details)
                            })
                        else:
                            print(f"❌ Not found: '{item_name}'")
                            not_found_items.append(f"{quantity} {item_name}")
                
                print(f"📊 Results: {len(detected_items)} found, {len(not_found_items)} not found")
                
                # If we have items detected but also some not found, return partial success with message
                if detected_items and not_found_items:
                    return {
                        "action": "add_multiple_partial",
                        "message_type": "text",
                        "items": detected_items,
                        "not_found_items": not_found_items,
                        "response_delay": 1000
                    }
                # If multiple items were detected, return multi-item add action
                elif len(detected_items) > 1:
                    return {
                        "action": "add_multiple",
                        "message_type": "text",
                        "items": detected_items,
                        "emotional_context": emotional_state,
                        "response_delay": 1000
                    }
                # If only one item detected from the 'and' split, continue to single item processing
                elif len(detected_items) == 1:
                    return {
                        "action": "add",
                        "message_type": "text",
                        "items": detected_items,
                        "response_delay": 1000
                    }
                # If no items found, return error message
                elif not_found_items:
                    return {
                        "action": "item_not_found",
                        "message_type": "text",
                        "not_found_items": not_found_items,
                        "response_delay": 1000
                    }
    
    # Single item detection (existing logic)
    for pattern in direct_item_patterns:
        direct_item_match = re.search(pattern, lower_message, re.IGNORECASE)
        if direct_item_match:
            # Group 1: quantity (optional), Group 2: item name
            quantity_str = direct_item_match.group(1)
            item_name = direct_item_match.group(2).strip() if direct_item_match.group(2) else direct_item_match.group(1).strip()
            quantity = int(quantity_str) if quantity_str and quantity_str.isdigit() else 1
            
            print(f"🔎 Single item search: '{item_name}' (quantity: {quantity})")
            
            # Use fuzzy matching to find the exact menu item with details
            item_details = find_menu_item_fuzzy_with_details(item_name)
            
            if item_details:
                print(f"✅ Found: '{item_name}' → '{item_details['name']}'")
                # Detect emotional state for personalized item comments
                emotional_state = detect_emotional_state(user_message)
                return {
                    "action": "add",
                    "message_type": "text",
                    "items": [{
                        "name": item_details['name'],
                        "quantity": quantity,
                        "price": item_details.get('price', 12.99),
                        "id": item_details.get('id', f"item-{quantity}"),
                        "human_comment": _make_human_comment_for_item(item_details, emotional_state)
                    }],
                    "emotional_context": emotional_state,
                    "response_delay": 1000
                }
            else:
                print(f"❌ Not found: '{item_name}'")
                return {
                    "action": "item_not_found",
                    "message_type": "text",
                    "not_found_items": [f"{quantity} {item_name}"],
                    "response_delay": 1000
                }
    
    # Default fallback
    return {"action": "none", "message_type": "text"}

def handle_rate_limit_fallback(user_message, cart_items):
    """Handle requests when OpenAI API rate limit is exceeded"""
    lower_message = user_message.lower()
    
    # Initialize default response
    response = "I'm currently experiencing high demand (rate limit reached), but I can still help you! What would you like to order?"
    
    # Check for greetings with emotional intelligence
    if any(greeting in lower_message for greeting in ['hi', 'hello', 'hey']):
        # Extract name if present
        name_match = re.search(r'(?:hi|hello|hey)\s*,?\s*([a-zA-Z]+)', lower_message, re.IGNORECASE)
        name = name_match.group(1).capitalize() if name_match else None
        
        # Detect emotional state
        emotional_state = detect_emotional_state(user_message)
        
        # Generate empathetic response even in fallback mode
        if emotional_state['emotion'] == 'crisis':
            if name:
                response = f"I'm deeply concerned about you, {name}. Please reach out for professional help if you're having thoughts of self-harm. Let me help you with some comfort food in the meantime."
            else:
                response = "I'm very concerned about you. Please consider reaching out to a mental health professional. Let me help you with some nourishing food right now."
        elif emotional_state['emotion'] in ['very_negative', 'negative']:
            if name:
                response = f"I'm so sorry you're going through a difficult time, {name}. Even though I'm experiencing technical limits, I'm here for you. Let me help you find something comforting."
            else:
                response = "I'm really sorry you're having such a hard time. Even with my current limitations, I want to help you find something comforting to eat."
        elif emotional_state['emotion'] == 'lonely':
            if name:
                response = f"You're not alone, {name}. I'm here with you, and I care about helping you get something wonderful to eat."
            else:
                response = "You're not alone right now. I'm here with you, and I want to help you find something delicious."
        elif emotional_state['emotion'] in ['positive', 'celebratory']:
            if name:
                response = f"I love your positive energy, {name}! Let's find something amazing to match your great mood."
            else:
                response = "Your positive energy is wonderful! Let's find something delicious to celebrate with."
        elif name:
            # Personalized greeting with name
            response = f"Hello, {name}! It's nice to meet you. I'm here to help you order some delicious food. How are you feeling today?"
        else:
            # Standard greeting
            response = "Hello there! I'm your friendly food ordering assistant. How are you doing today? What delicious items can I help you find?"
    
    # Detect intent and create appropriate response
    action_data = detect_intent_and_create_action(user_message, "")
    
    # Generate appropriate fallback responses
    if action_data['action'] == 'show_cart':
        if not cart_items:
            response = "Your cart is currently empty. I'd be happy to help you add some delicious items!"
        else:
            total_items = sum(item.get('quantity', 1) for item in cart_items)
            response = f"You have {total_items} item{'s' if total_items != 1 else ''} in your cart. Let me show you the details."
    
    elif action_data['action'] == 'add':
        # Handle direct item addition in fallback mode
        items = action_data.get('items', [])
        if items and isinstance(items[0], dict):
            item = items[0]
            quantity = item.get('quantity', 1) if isinstance(item, dict) else 1
            name = item.get('name', 'item') if isinstance(item, dict) else str(item)
            response = f"Great! I've added {quantity} {name} to your cart. Let me show you the updated cart."
            # Ensure cart summary is shown after addition
            action_data = {"action": "show_cart", "message_type": "text", "response_delay": 1000}
        else:
            response = "I'd be happy to add that item to your cart. Could you please specify the item name?"
    
    elif action_data['action'] == 'add_multiple':
        # Handle multiple items addition in fallback mode
        items = action_data.get('items', [])
        if items:
            item_names = []
            for item in items:
                if isinstance(item, dict):
                    quantity = item.get('quantity', 1)
                    name = item.get('name', 'item')
                    item_names.append(f"{quantity} {name}")
            if item_names:
                response = f"Excellent! I've added {' and '.join(item_names)} to your cart. Let me show you the updated cart."
                # Ensure cart summary is shown after addition
                action_data = {"action": "show_cart", "message_type": "text", "response_delay": 1000}
            else:
                response = "I'd be happy to add those items to your cart. Could you please specify the item names?"
    elif action_data['action'] == 'add_multiple_partial':
        # Handle partial multiple items addition in fallback mode
        items = action_data.get('items', [])
        not_found_items = action_data.get('not_found_items', [])
        if items:
            item_names = []
            for item in items:
                if isinstance(item, dict):
                    quantity = item.get('quantity', 1)
                    name = item.get('name', 'item')
                    item_names.append(f"{quantity} {name}")
            
            response = f"I've added {' and '.join(item_names)} to your cart."
            if not_found_items:
                response += f" However, I couldn't find {' and '.join(not_found_items)} on our menu."
            action_data = {"action": "show_cart", "message_type": "text", "response_delay": 1000}
        else:
            response = "I'd be happy to add those items to your cart. Could you please specify the item names?"
    
    elif action_data['action'] == 'item_not_found':
        # Handle item not found in fallback mode
        not_found_items = action_data.get('not_found_items', [])
        if not_found_items:
            response = f"I'm sorry, I couldn't find {' and '.join(not_found_items)} on our menu. Would you like me to show you our available items?"
        else:
            response = "I'm sorry, I couldn't find that item on our menu. Would you like me to show you our available items?"
    
    elif action_data['action'] == 'update':
        # Handle increase/decrease quantity in fallback mode
        operation = action_data.get('operation', 'update')
        target_item = action_data.get('target_item', '')
        quantity = action_data.get('quantity', 1)
        if operation == 'increase':
            response = f"I'll increase {target_item} by {quantity}. Let me update your cart."
        else:
            response = f"I'll decrease {target_item} by {quantity}. Let me update your cart."
        # Return the update action to be handled by frontend
        return jsonify({
            'response': response,
            'action_data': action_data,
            'success': True,
            'fallback_mode': True
        })
    
    elif action_data['action'] == 'clear_chat':
        # Handle clear chat in fallback mode
        response = "Chat cleared! How can I help you today?"
        action_data = {"action": "clear_chat", "message_type": "text", "response_delay": 500}
    
    elif action_data['action'] == 'place_order':
        if not cart_items:
            response = "Your cart is empty. Please add some items before placing an order."
        else:
            response = "Perfect! I'll process your order and generate a receipt for you."
            order_total = sum(item.get('total', item.get('price', 0) * item.get('quantity', 1)) for item in cart_items)
            action_data = {
                "action": "place_order",
                "message_type": "text",
                "order_id": f"ORD-{int(time.time())}",
                "order_total": order_total,
                "response_delay": 1500
            }
    
    elif action_data['action'] == 'bulk_menu':
        category = action_data.get('category', 'items')
        quantity = action_data.get('bulk_quantity', 2)
        response = f"Great choice! I'll show you our {category.lower()} options so you can select your {quantity} items."
    
    elif action_data['action'] == 'multi_category_bulk':
        categories = action_data.get('multi_categories', [])
        if categories:
            first_category = categories[0]
            if isinstance(first_category, dict):
                response = f"Perfect! I'll help you order from multiple categories. Let's start with {first_category.get('category', 'items')}!"
            else:
                response = "Perfect! I'll help you order from multiple categories. Let's start!"
        else:
            response = "I'll help you with your multi-category order. Let me show you the menu options."
    
    elif action_data['action'] == 'clear_chat':
        response = "Chat cleared! How can I help you today?"
        # Clear the conversation for this session
        # Get session_id from request data if available
        try:
            session_id = request.get_json().get('session_id') if request.get_json() else None
        except:
            session_id = None
        
        session_key = session_id if session_id else 'default'
        conversations[session_key] = [SystemMessage(content=get_system_prompt())]
    
    elif action_data['action'] == 'update':
        operation = action_data.get('operation', 'update')
        target = action_data.get('target', 'item')
        quantity = action_data.get('quantity', 1)
        
        if operation == 'increase':
            response = f"I'll increase {target} by {quantity}. Let me update your cart."
        else:
            response = f"I'll decrease {target} by {quantity}. Let me update your cart."
        
        # Ensure cart summary is shown after update
        action_data = {"action": "show_cart", "message_type": "text", "response_delay": 1000}
    
    elif 'menu' in lower_message or 'category' in lower_message:
        response = "I'd love to show you our delicious menu! Let me display all our categories for you."
        action_data = {"action": "show_menu", "message_type": "text", "response_delay": 1000}
    
    else:
        # Check for emotional context in any message
        negative_emotions = ['worst', 'bad', 'terrible', 'awful', 'sad', 'depressed', 'upset', 'angry', 'horrible', 'miserable']
        has_negative_emotion = any(emotion in lower_message for emotion in negative_emotions)
        
        if has_negative_emotion:
            # Show empathy for negative emotions in any context
            response = "I'm sorry to hear you're going through a tough time. Sometimes a delicious meal can help brighten the day. Would you like to hear about our menu options?"
        else:
            response = "I'm currently experiencing high demand (rate limit reached), but I can still help you! What would you like to order?"
    
    return jsonify({
        'response': response,
        'action_data': action_data,
        'success': True,
        'fallback_mode': True
    })

def get_system_prompt():
    # Refresh menu data if needed
    update_menu_items_from_graphql()
    
    # Create dynamic menu items list
    menu_items_str = ', '.join(MENU_ITEMS) if MENU_ITEMS else 'Loading menu items...'
    categories_str = ', '.join(MENU_CATEGORIES) if MENU_CATEGORIES else 'Loading categories...'
    
    return (
        "You are a friendly restaurant ordering assistant for a modern restaurant.\n"
        f"Valid menu items (use exact names): {menu_items_str}.\n"
        f"Available categories: {categories_str}.\n\n"
        "Your capabilities:\n"
        "- Help customers browse menu categories\n"
        "- Add items to cart with specified quantities\n"
        "- Handle multi-category bulk orders\n"
        "- Modify cart (increase/decrease quantities, remove items, remove all of an item type)\n"
        "- Show cart contents with totals\n"
        "- Handle unavailable items with alternatives\n"
        "- Support bulk quantity orders\n"
        "- Clear cart or chat history\n"
        "- Process order placement and generate receipt\n"
        "- Advanced emotional intelligence and empathy\n"
        "- Personalized responses based on emotional state\n"
        "- Crisis detection and supportive responses\n"
        "- Comfort food recommendations for different moods\n"
        "- Celebration enhancement for positive moments\n"
        "- Companion-like presence for lonely customers\n\n"
        "Key rules:\n"
        "- ALWAYS provide JSON actions for UI rendering\n"
        "- Keep text responses SHORT and let UI components show details\n"
        "- Never list items in text - always use UI actions instead\n"
        "- ALWAYS end with properly formatted JSON block\n"
        "- After adding items to cart, show cart summary\n"
        "- DETECT multi-category requests and use 'multi_category_bulk' action\n"
        "- For single category with quantity 2+, use 'bulk_menu' action\n"
        "- Support 'remove all [item type]' commands\n"
        "- Support 'clear chat' commands to reset chat history\n"
        "- After order placement, clear chat and send thank you message\n"
        "- PRIORITIZE emotional intelligence and empathy in ALL responses\n"
        "- Detect emotional state and adapt tone accordingly\n"
        "- Use names when provided and maintain emotional context\n"
        "- Show genuine care and concern for user wellbeing\n"
        "- Offer comfort food suggestions based on emotional state\n"
        "- Be a supportive companion, not just an order taker\n\n"
        "Advanced Emotional Intelligence Guidelines:\n"
        "- Detect wide range of emotions: crisis/suicidal thoughts, severe depression, sadness, anger, loneliness, illness, celebrations, happiness\n"
        "- Crisis Detection: If user expresses suicidal thoughts or severe crisis, show deep concern and suggest professional help while offering comfort\n"
        "- Empathy Matching: Match your empathy level to the intensity of user's emotions\n"
        "- Personalization: Use names when provided and remember emotional context throughout conversation\n"
        "- Comfort Food Therapy: Suggest specific comfort foods based on emotional state (warm soups for sadness, celebration dishes for happiness)\n"
        "- Validation: Always validate user's feelings before offering solutions\n"
        "- Presence: Make users feel heard and less alone, especially those expressing loneliness\n"
        "- Supportive Language: Use phrases like 'I'm here for you', 'You matter', 'I care about your experience'\n"
        "- Recovery Support: For negative emotions, offer hope and encouragement while respecting their current state\n"
        "- Celebration Enhancement: Amplify joy for users sharing positive news or celebrations\n\n"
        "Category mapping:\n"
        "- 'pizza' → 'Pizza', 'pasta' → 'Pasta', 'salad' → 'Salads'\n"
        "- 'seafood', 'fish', 'salmon', 'shrimp' → 'Seafood'\n"
        "- 'water', 'drink', 'beverage', 'juice', 'soda' → 'Beverages'\n"
        "- 'dessert', 'cake', 'sweet' → 'Desserts'\n"
        "- 'appetizer', 'starter', 'app' → 'Appetizers'\n"
        "- 'main course', 'entree', 'burger', 'chicken' → 'Main Courses'\n\n"
        "Always end your response with a JSON block containing the appropriate action.\n"
        "Example JSON format:\n"
        "``json\n"
        "{\n"
        "  \"action\": \"add|remove|remove_all|update|show_menu|show_cart|place_order|bulk_menu|multi_category_bulk\",\n"
        "  \"items\": [{\"name\": \"item_name\", \"quantity\": number}],\n"
        "  \"target_item\": \"item_name\",\n"
        "  \"message_type\": \"text\",\n"
        "  \"category\": \"category_name\",\n"
        "  \"bulk_quantity\": number,\n"
        "  \"multi_categories\": [{\"category\": \"name\", \"quantity\": number}],\n"
        "  \"order_total\": number,\n"
        "  \"order_id\": \"string\",\n"
        "  \"response_delay\": 1000\n"
        "}\n"
        "```"
    )

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'response': "Invalid request data",
                'action_data': {"action": "none", "message_type": "text"},
                'success': False
            }), 400

        user_message = data.get('message', '')
        session_id = data.get('session_id', 'default')
        cart_items = data.get('cart_items', [])
        user_mood = data.get('user_mood', None)
        empathy_level = data.get('empathy_level', 'standard')

        # Refresh menu data
        update_menu_items_from_graphql()

        # --- EARLY deterministic intent detection / local parsing (avoid LLM when possible) ---
        # 1) try quick structured parse for explicit items (local rules)
        local_items = extract_items_from_text(user_message)
        if local_items:
            # return structured add_multiple or add
            items_out = []
            for it in local_items:
                # try to resolve to menu details (best effort)
                details = find_menu_item_fuzzy_with_details(it['name']) or {'name': it['name'], 'price': 0.0}
                items_out.append({
                    'name': details.get('name', it['name']),
                    'quantity': int(it.get('quantity', 1)),
                    'price': details.get('price', 0.0),
                    'id': details.get('id', f"item-{int(time.time())}"),
                    'human_comment': _make_human_comment_for_item(details)
                })

            action = 'add_multiple' if len(items_out) > 1 else 'add'
            # Build a safe human-friendly summary string (avoid nested/nested f-strings)
            if action == 'add_multiple':
                item_strs = ', '.join(f"{i['quantity']} {i['name']}" for i in items_out)
                resp_text = f"Great - adding {item_strs} to your cart."
            else:
                resp_text = f"Great - adding {items_out[0]['quantity']} {items_out[0]['name']} to your cart."

            return jsonify({
                'response': resp_text,
                'action_data': {
                    'action': action,
                    'items': items_out,
                    'message_type': 'text',
                    'response_delay': 800
                },
                'success': True
            })

        # 2) run deterministic intent detector for other UI actions
        early_action = detect_intent_and_create_action(user_message, "")
        if early_action and early_action.get('action') and early_action.get('action') != 'none':
            # If it's a greeting, return a short personalized response immediately (avoid LLM)
            if early_action.get('action') == 'greeting':
                return jsonify({
                    'response': early_action.get('response_text', 'Hello!'),
                    'action_data': { **early_action, 'message_type': 'text' },
                    'success': True
                })
            # return early if detected (avoid LLM) for other deterministic actions
            return jsonify({
                'response': '',  # frontend will use action_data to render short messages
                'action_data': { **early_action, 'message_type': 'text' },
                'success': True
            })

        # --- end early detection ---

        # Initialize or get conversation history
        if session_id not in conversations:
            conversations[session_id] = [SystemMessage(content=get_system_prompt())]

        messages = conversations[session_id]

        # Add cart & mood context and user message
        cart_context = f"\nCurrent cart: {json.dumps(cart_items)}" if cart_items else "\nCart is empty."
        mood_context = f"\nUser mood: {json.dumps(user_mood)}" if user_mood else ""
        empathy_context = f"\nEmpathy level: {empathy_level}" if empathy_level != 'standard' else ""
        full_message = user_message + cart_context + mood_context + empathy_context

        messages.append(HumanMessage(content=full_message))

        # Check LLM availability
        if llm is None:
            return jsonify({
                'response': "AI service is not available. Please check the OpenAI API key configuration.",
                'action_data': {"action": "none", "message_type": "text"},
                'success': False,
                'error': "OpenAI client not initialized"
            }), 503

        # Get AI response
        try:
            response = llm.invoke(messages)
            text = str(response.content).strip() if hasattr(response, 'content') else ""
        except Exception as e:
            # existing error handling (rate limit fallback etc.)
            error_message = str(e)
            print(f"OpenAI API Error: {error_message}")
            if "rate_limit_exceeded" in error_message or "429" in error_message or "Rate limit reached" in error_message:
                return handle_rate_limit_fallback(user_message, cart_items)
            else:
                return handle_rate_limit_fallback(user_message, cart_items)

        # Extract JSON from LLM text robustly (fenced or inline) and remove from visible response
        extracted_json, cleaned_text = extract_json_from_text(text)
        action_data = None
        if extracted_json:
            action_data = extracted_json
            action_data['message_type'] = 'text'
            natural_response = clean_response_formatting(cleaned_text)
        else:
            # try to parse JSON in the natural response via detect_intent fallback
            natural_response = clean_response_formatting(re.sub(r"```json.*```", "", text, flags=re.DOTALL).strip())
            # try to extract JSON using previous regex as fallback
            json_block = re.search(r"```json\s*(\{.*\})\s*```", text, re.DOTALL)
            if json_block:
                try:
                    action_data = json.loads(json_block.group(1))
                    action_data['message_type'] = 'text'
                except Exception:
                    action_data = detect_intent_and_create_action(user_message, natural_response)
            else:
                # last resort: attempt to detect intent from message
                action_data = detect_intent_and_create_action(user_message, natural_response)
            if action_data and 'message_type' not in action_data:
                action_data['message_type'] = 'text'

        # Add assistant response to conversation history (without JSON)
        messages.append(AIMessage(content=natural_response))

        # Trim history
        if len(messages) > 21:
            messages = [messages[0]] + messages[-20:]
        conversations[session_id] = messages

        response_data = {
            'response': natural_response,
            'action_data': action_data or {"action": "none", "message_type": "text"},
            'success': True
        }

        # If action is UI-driven menu display, keep textual response short (prevent listing menu items in chat)
        if action_data and isinstance(action_data, dict) and action_data.get('action') == 'show_menu':
            response_data['response'] = 'Opening the menu for you.'
            # ensure message_type present
            response_data['action_data']['message_type'] = response_data['action_data'].get('message_type', 'text')

        # Enhanced emotional processing and follow-up responses
        emotional_state = detect_emotional_state(user_message)
        if emotional_state['emotion'] != 'neutral':
            response_data['emotional_state'] = emotional_state
            
            # Generate appropriate follow-up based on emotional intensity
            if emotional_state['emotion'] == 'crisis':
                response_data['follow_up'] = {
                    "message": "Please know that I genuinely care about your wellbeing. If you're having thoughts of self-harm, please reach out to a mental health crisis line. You are valuable and your life matters. Now, let me help you with some nourishing food.",
                    "response_delay": 1500,
                    "priority": "urgent"
                }
            elif emotional_state['intensity'] in ['very_high', 'high']:
                follow_up_messages = [
                    "I want you to know that your feelings are valid, and you're not alone in this. I'm here to help in whatever small way I can.",
                    "Sometimes when we're going through tough times, taking care of our basic needs like eating well can be a form of self-care. Let me help with that.",
                    "You've reached out today, and that shows strength. Let me make sure you get something nourishing and comforting."
                ]
                response_data['follow_up'] = {
                    "message": random.choice(follow_up_messages),
                    "response_delay": 1200
                }
            elif emotional_state['emotion'] == 'lonely':
                response_data['follow_up'] = {
                    "message": "You're not alone right now - I'm here with you, and I genuinely enjoy our conversation. Let's find you something wonderful to eat.",
                    "response_delay": 1000
                }
            elif emotional_state['emotion'] == 'positive' or emotional_state['emotion'] == 'celebratory':
                response_data['follow_up'] = {
                    "message": "Your positive energy makes my day brighter too! Let's find something amazing to match your great mood.",
                    "response_delay": 800
                }
            elif emotional_state['emotion'] == 'unwell':
                response_data['follow_up'] = {
                    "message": "I hope you feel better soon. When we're not feeling well, it's especially important to nourish ourselves. Let me help you find something gentle and healing.",
                    "response_delay": 1000
                }

        return jsonify(response_data)

    except Exception as e:
        return jsonify({
            'response': "I'm sorry, I encountered an error. Please try again.",
            'action_data': {"action": "none", "message_type": "text"},
            'success': False,
            'error': str(e)
        }), 500

@app.route('/clear_session', methods=['POST'])
def clear_session():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Invalid request data'}), 400
            
        session_id = data.get('session_id', 'default')
        
        if session_id in conversations:
            conversations[session_id] = [SystemMessage(content=get_system_prompt())]
        
        return jsonify({
            'success': True,
            'message': 'Chat cleared! How can I help you today?'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    ai_status = "ready" if llm is not None else "api_key_required"
    
    # Check if we've recently hit rate limits
    rate_limit_status = "normal"
    try:
        # Try a simple test call to check status
        if llm is not None:
            # This won't actually make a call, just checks if the client is configured
            rate_limit_status = "ready"
    except Exception as e:
        if "rate_limit" in str(e) or "429" in str(e):
            rate_limit_status = "rate_limited"
            ai_status = "rate_limited"
    
    return jsonify({
        'status': 'healthy', 
        'service': 'chatbot',
        'ai_status': ai_status,
        'rate_limit_status': rate_limit_status,
        'message': 'AI service ready' if llm is not None else 'Please configure OpenAI API key',
        'fallback_available': True
    })

@app.route('/menu', methods=['GET'])
def get_menu_info():
    """Get current menu items and categories"""
    try:
        # Refresh menu data
        success = update_menu_items_from_graphql()
        
        return jsonify({
            'success': True,
            'items': MENU_ITEMS,
            'categories': MENU_CATEGORIES,
            'total_items': len(MENU_ITEMS),
            'total_categories': len(MENU_CATEGORIES),
            'data_source': 'GraphQL' if success else 'Fallback',
            'last_updated': LAST_FETCH_TIME
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'items': [],
            'categories': []
        }), 500

@app.route('/menu/refresh', methods=['POST'])
def refresh_menu_data():
    """Manually refresh menu data from GraphQL"""
    try:
        # Force refresh by clearing cache
        global LAST_FETCH_TIME
        LAST_FETCH_TIME = 0
        
        success = update_menu_items_from_graphql()
        
        return jsonify({
            'success': success,
            'message': 'Menu data refreshed successfully' if success else 'Failed to refresh from GraphQL, using fallback',
            'items_count': len(MENU_ITEMS),
            'categories_count': len(MENU_CATEGORIES),
            'data_source': 'GraphQL' if success else 'Fallback'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def _normalize_text(s):
    if not s:
        return ''
    s = s.lower()
    s = s.replace('&', 'and')
    s = re.sub(r"[’‘'\"`]", '', s)
    s = re.sub(r'[^a-z0-9\s]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def _singularize_token(t):
    if not t:
        return t
    # basic plural -> singular heuristics
    if t.endswith('ies') and len(t) > 3:
        return t[:-3] + 'y'
    if t.endswith('es') and len(t) > 2:
        return t[:-2]
    if t.endswith('s') and len(t) > 2:
        return t[:-1]
    return t

def extract_items_from_text(text):
    """
    Return list of {'name': str, 'quantity': int} for items parsed from text.
    Handles:
      - "2 Fish and Chips and 1 Grilled Salmon"
      - "I want Fish and Chips"
      - "Add 3 burgers"
    Avoids splitting 'Fish and Chips' when it is a single menu item by returning the whole phrase first.
    
    IMPORTANT: Ignores remove/delete/decrease commands to prevent false positives.
    """
    if not text:
        return []

    # First check if this is a remove/delete/decrease command - if so, return empty to let remove patterns handle it
    lower_text = text.lower()
    remove_indicators = ['remove', 'delete', 'cancel', 'take out', 'decrease', 'reduce']
    if any(indicator in lower_text for indicator in remove_indicators):
        return []

    items = []

    # 1) explicit quantity patterns like "2 Fish and Chips"
    for m in re.finditer(r'(\d+)\s+([A-ZaZ0-9&\'\-\s]+?)(?=(?:\s+(?:and|,|&)\s+\d|\s*$|[.,!?]))', text, re.I):
        qty = int(m.group(1))
        name = m.group(2).strip().rstrip('.,!?')
        items.append({'name': name, 'quantity': qty})

    if items:
        return items

    # 2) "I want X and Y" -> multiple without numbers. But first check if whole phrase is a single item.
    m = re.search(r'(?:i want|i\'d like|i would like|order|add|i want to order)\s+(.+)$', text, re.I)
    if m:
        raw = m.group(1).strip().rstrip('.,!?')
        norm_raw = _normalize_text(raw)
        # if the raw phrase looks like "2 grilled salmon" capture leading number
        leading_num = re.match(r'^(\d+)\s+(.+)$', raw)
        if leading_num:
            return [{'name': leading_num.group(2).strip(), 'quantity': int(leading_num.group(1))}]

        # If backend has access to menu list it could check here; otherwise return split parts as items
        # Try to split into parts but avoid splitting common "X and Y" that might be single item by returning joined phrase first
        parts = re.split(r'\s+(?:and|&|,)\s+', raw, flags=re.I)
        if len(parts) == 1:
            # single item (no explicit separator)
            # check for leading number inside single part
            m2 = re.match(r'^(?:\b(\d+)\b\s*)?(.+)$', raw)
            if m2:
                qty = int(m2.group(1)) if m2.group(1) else 1
                name = m2.group(2).strip()
                return [{'name': name, 'quantity': qty}]
        else:
            for p in parts:
                pm = re.match(r'^(?:\b(\d+)\b\s*)?(.+)$', p.strip())
                if pm:
                    qty = int(pm.group(1)) if pm.group(1) else 1
                    name = pm.group(2).strip().rstrip('.,!?')
                    items.append({'name': name, 'quantity': qty})
            if items:
                return items

    # 3) last fallback: look for "add X" pattern
    m = re.search(r'\badd\s+(?:\b(\d+)\b\s*)?(.+?)(?:[.?!]|$)', text, re.I)
    if m:
        qty = int(m.group(1)) if m.group(1) else 1
        name = m.group(2).strip().rstrip('.,!?')
        return [{'name': name, 'quantity': qty}]

    return []

def extract_json_from_text(text: str):
    """Return (json_obj or None, cleaned_text_without_json)
    - Finds fenced ```json { ... } ``` blocks first.
    - Falls back to extracting the first balanced {...} object found anywhere.
    """
    if not text:
        return None, text

    # 1) fenced ```json ... ``` block
    m = re.search(r"```json\s*(\{[\s\S]*\})\s*```", text, flags=re.IGNORECASE)
    if m:
        try:
            obj = json.loads(m.group(1))
            cleaned = text[:m.start()] + text[m.end():]
            return obj, cleaned.strip()
        except Exception:
            pass

    # 2) inline JSON object: find first '{' and capture balanced braces
    start = text.find('{')
    if start != -1:
        stack = []
        for i in range(start, len(text)):
            ch = text[i]
            if ch == '{':
                stack.append('{')
            elif ch == '}':
                if stack:
                    stack.pop()
                    if not stack:
                        candidate = text[start:i+1]
                        try:
                            obj = json.loads(candidate)
                            cleaned = text[:start] + text[i+1:]
                            return obj, cleaned.strip()
                        except Exception:
                            break
        # No valid JSON parsed; continue below

    # 3) nothing found
    return None, text

if __name__ == '__main__':
    print("[CHATBOT] Starting Restaurant Chatbot Service...")
    print("📡 Service will be available at http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)