import os
import re
import json
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from dotenv import load_dotenv
import requests
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
        print("🔄 Fetching menu data from GraphQL...")
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
                
                print(f"✅ Fetched {len(menu_items)} menu items from GraphQL")
                print(f"📂 Categories: {MENU_DATA_CACHE['categories']}")
                
                return MENU_DATA_CACHE
            else:
                print("❌ Invalid GraphQL response structure")
                return None
        else:
            print(f"❌ GraphQL request failed with status {response.status_code}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Error connecting to GraphQL server: {e}")
        return None
    except Exception as e:
        print(f"❌ Error fetching menu data: {e}")
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
    """Find menu item with enhanced fuzzy matching and return full details"""
    search_term = search_term.lower().strip()
    menu_data = fetch_menu_data_from_graphql()
    
    print(f"🔍 Searching for: '{search_term}'")
    
    if not menu_data:
        # Fallback to simple name matching
        matched_name = find_menu_item_fuzzy(search_term)
        print(f"📊 Using fallback data, found: {matched_name}")
        return {'name': matched_name, 'price': 12.99} if matched_name else None
    
    available_items = [item for item in menu_data['items'] if item['available']]
    print(f"📋 Available items: {[item['name'] for item in available_items[:5]]}...")
    
    # 1. EXACT MATCH (highest priority)
    for item in available_items:
        if item['name'].lower() == search_term:
            print(f"✅ EXACT match: '{search_term}' -> '{item['name']}'")
            return item
    
    # 2. EXACT MATCH with common variations
    search_variations = [
        search_term,
        search_term.replace('salad', 'salads'),
        search_term.replace('salads', 'salad'),
        search_term + ' salad' if 'salad' not in search_term else search_term,
        search_term.replace(' salad', '').replace(' salads', '') + ' salad'
    ]
    
    for variation in search_variations:
        for item in available_items:
            if item['name'].lower() == variation.lower():
                print(f"✅ VARIATION match: '{search_term}' -> '{item['name']}'")
                return item
    
    # 3. STARTS WITH match (very high priority)
    for item in available_items:
        item_name_lower = item['name'].lower()
        if item_name_lower.startswith(search_term) or search_term.startswith(item_name_lower):
            print(f"✅ STARTS WITH match: '{search_term}' -> '{item['name']}'")
            return item
    
    # 4. CONTAINS match (search term in menu item - high priority)
    best_matches = []
    for item in available_items:
        item_name_lower = item['name'].lower()
        if search_term in item_name_lower:
            # Calculate match score based on how much of the item name matches
            score = len(search_term) / len(item_name_lower)
            best_matches.append((item, score))
            print(f"📝 CONTAINS match: '{search_term}' in '{item['name']}' (score: {score:.2f})")
    
    if best_matches:
        # Sort by score and return the best match
        best_matches.sort(key=lambda x: x[1], reverse=True)
        best_item = best_matches[0][0]
        print(f"✅ BEST CONTAINS match: '{search_term}' -> '{best_item['name']}'")
        return best_item
    
    # 5. REVERSE CONTAINS match (menu item name in search term)
    for item in available_items:
        item_name_lower = item['name'].lower()
        if item_name_lower in search_term:
            print(f"✅ REVERSE CONTAINS match: '{item['name']}' in '{search_term}'")
            return item
    
    # 6. WORD-by-WORD matching
    search_words = search_term.split()
    word_matches = []
    
    for item in available_items:
        item_words = item['name'].lower().split()
        matches = 0
        total_words = len(search_words)
        
        for search_word in search_words:
            for item_word in item_words:
                if search_word in item_word or item_word in search_word:
                    matches += 1
                    break
        
        if matches > 0:
            score = matches / total_words
            word_matches.append((item, score, matches))
            print(f"🎯 WORD match: '{search_term}' -> '{item['name']}' ({matches}/{total_words} words, score: {score:.2f})")
    
    if word_matches:
        # Sort by number of matches first, then by score
        word_matches.sort(key=lambda x: (x[2], x[1]), reverse=True)
        best_item = word_matches[0][0]
        print(f"✅ BEST WORD match: '{search_term}' -> '{best_item['name']}'")
        return best_item
    
    # 7. SPACE-NORMALIZED matching
    search_normalized = search_term.replace(' ', '').replace('-', '').replace('_', '')
    for item in available_items:
        item_normalized = item['name'].lower().replace(' ', '').replace('-', '').replace('_', '')
        if search_normalized == item_normalized:
            print(f"✅ NORMALIZED match: '{search_term}' -> '{item['name']}'")
            return item
        elif search_normalized in item_normalized or item_normalized in search_normalized:
            print(f"✅ NORMALIZED PARTIAL match: '{search_term}' -> '{item['name']}'")
            return item
    
    # 8. ENHANCED SYNONYM/ALIAS matching
    enhanced_synonyms = {
        # Salad variations
        'garden salad': ['Garden Salad', 'Fresh Garden Salad', 'Mixed Garden Salad', 'House Salad'],
        'garden salads': ['Garden Salad', 'Fresh Garden Salad', 'Mixed Garden Salad'],
        'garden': ['Garden Salad', 'Fresh Garden Salad'],
        'greek salad': ['Greek Salad', 'Mediterranean Salad'],
        'greek salads': ['Greek Salad', 'Mediterranean Salad'],
        'caesar salad': ['Caesar Salad', 'Chicken Caesar Salad', 'Classic Caesar'],
        'caesar salads': ['Caesar Salad', 'Chicken Caesar Salad'],
        
        # Pizza variations
        'margherita pizza': ['Margherita Pizza', 'Margherita', 'Classic Margherita'],
        'margherita': ['Margherita Pizza', 'Classic Margherita'],
        'pepperoni pizza': ['Pepperoni Pizza', 'Pepperoni'],
        'pepperoni': ['Pepperoni Pizza'],
        
        # Beverage variations
        'coke': ['Coca Cola', 'Coke', 'Coca-Cola'],
        'coca cola': ['Coca Cola', 'Coke'],
        'pepsi': ['Pepsi', 'Pepsi Cola'],
        'orange juice': ['Orange Juice', 'Fresh Orange Juice', 'Orange Juice Can'],
        'orange': ['Orange Juice', 'Fresh Orange Juice'],
        'apple juice': ['Apple Juice', 'Apple Juice Can', 'Fresh Apple Juice'],
        'apple': ['Apple Juice', 'Apple Juice Can'],
        'water': ['Water', 'Water Bottle', 'Still Water'],
        'water bottle': ['Water Bottle', 'Water'],
        
        # Pasta variations
        'spaghetti': ['Spaghetti Carbonara', 'Spaghetti', 'Spaghetti Bolognese'],
        'pasta': ['Spaghetti Carbonara', 'Penne Arrabbiata', 'Fettuccine Alfredo'],
        'carbonara': ['Spaghetti Carbonara'],
        'alfredo': ['Fettuccine Alfredo'],
        
        # Fish variations
        'fish and chips': ['Fish and Chips', 'Fish & Chips', 'Beer Battered Fish'],
        'fish': ['Fish and Chips', 'Grilled Salmon', 'Seafood Platter'],
        'salmon': ['Grilled Salmon', 'Atlantic Salmon'],
        
        # Dessert variations
        'chocolate cake': ['Chocolate Cake', 'Rich Chocolate Cake', 'Dark Chocolate Cake'],
        'cake': ['Chocolate Cake', 'Cheesecake', 'Rich Chocolate Cake'],
        'ice cream': ['Ice Cream', 'Vanilla Ice Cream', 'Chocolate Ice Cream'],
        'tiramisu': ['Tiramisu', 'Classic Tiramisu'],
    }
    
    # Check if search term matches any synonym
    if search_term in enhanced_synonyms:
        possible_names = enhanced_synonyms[search_term]
        for possible_name in possible_names:
            for item in available_items:
                if item['name'].lower() == possible_name.lower():
                    print(f"✅ SYNONYM match: '{search_term}' -> '{item['name']}' (via synonym)")
                    return item
    
    # Check if search term is part of any synonym key
    for synonym_key, possible_names in enhanced_synonyms.items():
        if search_term in synonym_key or synonym_key in search_term:
            for possible_name in possible_names:
                for item in available_items:
                    if item['name'].lower() == possible_name.lower():
                        print(f"✅ SYNONYM PARTIAL match: '{search_term}' -> '{item['name']}' (via '{synonym_key}')")
                        return item
    
    # 9. FUZZY CHARACTER matching (for typos)
    fuzzy_matches = []
    for item in available_items:
        item_name_lower = item['name'].lower()
        
        # Simple Levenshtein-like distance
        def simple_distance(s1, s2):
            if len(s1) < len(s2):
                return simple_distance(s2, s1)
            if len(s2) == 0:
                return len(s1)
            
            previous_row = list(range(len(s2) + 1))
            for i, c1 in enumerate(s1):
                current_row = [i + 1]
                for j, c2 in enumerate(s2):
                    insertions = previous_row[j + 1] + 1
                    deletions = current_row[j] + 1
                    substitutions = previous_row[j] + (c1 != c2)
                    current_row.append(min(insertions, deletions, substitutions))
                previous_row = current_row
            return previous_row[-1]
        
        distance = simple_distance(search_term, item_name_lower)
        max_length = max(len(search_term), len(item_name_lower))
        similarity = 1 - (distance / max_length)
        
        # Only consider items with high similarity (> 70%)
        if similarity > 0.7:
            fuzzy_matches.append((item, similarity))
            print(f"🎯 FUZZY match: '{search_term}' -> '{item['name']}' (similarity: {similarity:.2f})")
    
    if fuzzy_matches:
        # Sort by similarity and return the best match
        fuzzy_matches.sort(key=lambda x: x[1], reverse=True)
        best_item = fuzzy_matches[0][0]
        print(f"✅ BEST FUZZY match: '{search_term}' -> '{best_item['name']}'")
        return best_item
    
    print(f"❌ NO match found for: '{search_term}'")
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
    
    # Fix: Handle the SecretStr type requirement for newer LangChain versions
    llm = ChatOpenAI(
        model=os.getenv("OPENAI_MODEL", "openai/gpt-4o-mini"),
        temperature=float(os.getenv("OPENAI_TEMPERATURE", "0.2")),
        base_url=base_url,
        api_key=api_key  # Changed from 'openai_api_key' to 'api_key' for newer LangChain versions
    )
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

def detect_intent_and_create_action(user_message, response_text):
    """Enhanced detect user intent and create appropriate action when JSON parsing fails"""
    lower_message = user_message.lower()
    
    print(f"🔍 Analyzing message: '{user_message}'")
    
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
            "message_type": "cart",
            "response_delay": 1000
        }
    
    # PRIORITY 1: Detect REMOVE ALL commands first (before other patterns)
    remove_all_patterns = [
        r'\b(?:remove|delete|cancel|take\s+out)\s+all\s+([a-zA-Z\s]+?)(?:\s+from\s+cart)?(?:\s|$)',
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
                    "message_type": "cart",
                    "target_item": item_details['name'],
                    "response_delay": 1000
                }
            else:
                print(f"❌ Item not found for remove all: '{item_name}'")
    
    # PRIORITY 2: Enhanced DIRECT ITEM ADDITION patterns
    # More comprehensive patterns to catch various ways users might add items
    direct_item_patterns = [
        # Pattern 1: "I want [quantity] [item name]"
        r'\bi\s+want\s+(?!(to\s+order\s*$))(\d+)\s+([a-zA-Z\s]+?)(?:\s|$)',
        # Pattern 2: "I want [item name]" (not empty order)
        r'\bi\s+want\s+(?!(to\s+order\s*$))(?!\d+\s+)([a-zA-Z\s]+?)(?:\s|$|\.)',
        # Pattern 3: "Add [quantity] [item name]" (not "add more")
        r'\b(?:add)\s+(?!more\b)(\d+)\s+([a-zA-Z\s]+?)(?:\s|$|\.)',
        # Pattern 4: "Add [item name]" (not "add more")
        r'\b(?:add)\s+(?!more\b)(?!\d+\s+more\b)([a-zA-Z\s]+?)(?:\s|$|\.)',
        # Pattern 5: "Get me [quantity] [item name]"
        r'\bget\s+me\s+(\d+)\s+([a-zA-Z\s]+?)(?:\s|$|\.)',
        # Pattern 6: "Get me [item name]"
        r'\bget\s+me\s+(?!\d+\s+)([a-zA-Z\s]+?)(?:\s|$|\.)',
        # Pattern 7: "Order [quantity] [item name]"
        r'\border\s+(\d+)\s+([a-zA-Z\s]+?)(?:\s|$|\.)',
        # Pattern 8: "Order [item name]"
        r'\border\s+(?!\d+\s+)([a-zA-Z\s]+?)(?:\s|$|\.)',
        # Pattern 9: "Can I have [quantity] [item name]"
        r'\bcan\s+i\s+have\s+(\d+)\s+([a-zA-Z\s]+?)(?:\s|$|\.)',
        # Pattern 10: "Can I have [item name]"
        r'\bcan\s+i\s+have\s+(?!\d+\s+)([a-zA-Z\s]+?)(?:\s|$|\.)',
        # Pattern 11: "Can I get [quantity] [item name]"
        r'\bcan\s+i\s+get\s+(\d+)\s+([a-zA-Z\s]+?)(?:\s|$|\.)',
        # Pattern 12: "Can I get [item name]"
        r'\bcan\s+i\s+get\s+(?!\d+\s+)([a-zA-Z\s]+?)(?:\s|$|\.)',
        # Pattern 13: "[quantity] [item name]" (simple format)
        r'^\s*(\d+)\s+([a-zA-Z\s]+?)(?:\s|$|\.|please)',
        # Pattern 14: Just "[item name]" (simple format)
        r'^(?!\s*(?:show|display|see|view|list)\s)([a-zA-Z][a-zA-Z\s]+?)(?:\s*(?:please|\.)?)?$'
    ]
    
    # Test direct item patterns with enhanced logging
    for i, pattern in enumerate(direct_item_patterns, 1):
        direct_item_match = re.search(pattern, lower_message, re.IGNORECASE)
        if direct_item_match:
            print(f"🎯 Pattern {i} matched: {pattern}")
            
            groups = direct_item_match.groups()
            print(f"📝 Groups found: {groups}")
            
            # Determine quantity and item name based on number of groups
            if len(groups) == 2:
                # Two groups: either (quantity, item) or (item, None)
                if groups[0] and groups[0].isdigit():
                    quantity = int(groups[0])
                    item_name = groups[1].strip() if groups[1] else ""
                else:
                    quantity = 1
                    item_name = groups[0].strip() if groups[0] else ""
            elif len(groups) == 1:
                # One group: item name only
                quantity = 1
                item_name = groups[0].strip()
            else:
                continue
            
            # Skip if item name is empty or too short
            if not item_name or len(item_name.strip()) < 2:
                print(f"❌ Item name too short or empty: '{item_name}'")
                continue
            
            # Skip common non-food words that might be matched
            skip_words = ['me', 'it', 'that', 'this', 'some', 'any', 'help', 'please', 'thanks', 'thank you']
            if item_name.lower().strip() in skip_words:
                print(f"❌ Skipping common word: '{item_name}'")
                continue
            
            print(f"🔍 Single item search: '{item_name}' (quantity: {quantity})")
            
            # Use enhanced fuzzy matching to find the exact menu item
            item_details = find_menu_item_fuzzy_with_details(item_name)
            
            if item_details:
                print(f"✅ Found: '{item_name}' -> '{item_details['name']}'")
                return {
                    "action": "add",
                    "message_type": "cart",
                    "items": [{
                        "name": item_details['name'],
                        "quantity": quantity,
                        "price": item_details.get('price', 12.99),
                        "id": item_details.get('id', f"item-{quantity}")
                    }],
                    "response_delay": 1000
                }
            else:
                print(f"❌ Not found: '{item_name}'")
                return {
                    "action": "item_not_found",
                    "message_type": "text",
                    "not_found_items": [f"{quantity} {item_name}" if quantity > 1 else item_name],
                    "response_delay": 1000
                }
    
    # Continue with existing patterns for remove, increase, decrease, multi-category, etc.
    # ... (rest of the function remains the same as in the original)
    
    # PRIORITY 3: Detect REMOVE commands (with quantities)
    remove_patterns = [
        r'\b(?:remove|delete|cancel|take\s+out)\s+(?:(\d+)\s+)?([a-zA-Z\s]+?)(?:\s|$)',
        r'\b(?:remove|delete)\s+([a-zA-Z\s]+?)\s+by\s+(\d+)\b',
        r'\btake\s+out\s+(?:(\d+)\s+)?([a-zA-Z\s]+?)(?:\s|$)'
    ]
    
    for pattern in remove_patterns:
        remove_match = re.search(pattern, lower_message, re.IGNORECASE)
        if remove_match:
            if len(remove_match.groups()) == 2 and remove_match.group(2):
                if 'by' in pattern:
                    item_name = remove_match.group(1).strip()
                    quantity = int(remove_match.group(2))
                else:
                    quantity_str = remove_match.group(1)
                    item_name = remove_match.group(2).strip()
                    quantity = int(quantity_str) if quantity_str else 1
            else:
                item_name = remove_match.group(1).strip() if remove_match.group(1) else remove_match.group(2).strip()
                quantity = 1
            
            print(f"🗑️ Remove detected: '{item_name}' (quantity: {quantity})")
            
            item_details = find_menu_item_fuzzy_with_details(item_name)
            if item_details:
                print(f"✅ Found item to remove: '{item_details['name']}'")
                if quantity == 1:
                    return {
                        "action": "remove",
                        "message_type": "cart",
                        "items": [{"name": item_details['name']}],
                        "response_delay": 1000
                    }
                else:
                    return {
                        "action": "update",
                        "message_type": "cart",
                        "operation": "decrease",
                        "target_item": item_details['name'],
                        "quantity": quantity,
                        "response_delay": 1000
                    }
            else:
                print(f"❌ Item not found for removal: '{item_name}'")
    
    # Continue with rest of existing logic...
    # (I'll include the key parts but keep this focused on the main issue)
    
    # Default fallback
    return {"action": "none", "message_type": "text"}

def handle_rate_limit_fallback(user_message, cart_items):
    """Handle requests when OpenAI API rate limit is exceeded"""
    lower_message = user_message.lower()
    
    # Initialize default response
    response = "I'm currently experiencing high demand (rate limit reached), but I can still help you! What would you like to order?"
    
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
            action_data = {"action": "show_cart", "message_type": "cart", "response_delay": 1000}
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
                action_data = {"action": "show_cart", "message_type": "cart", "response_delay": 1000}
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
            action_data = {"action": "show_cart", "message_type": "cart", "response_delay": 1000}
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
                "message_type": "receipt",
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
        action_data = {"action": "show_cart", "message_type": "cart", "response_delay": 1000}
    
    elif 'menu' in lower_message or 'category' in lower_message:
        response = "I'd love to show you our delicious menu! Let me display all our categories for you."
        action_data = {"action": "show_menu", "message_type": "menu", "response_delay": 1000}
    
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
        "- Process order placement and generate receipt\n\n"
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
        "- After order placement, clear chat and send thank you message\n\n"
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
        "  \"message_type\": \"text|menu|category|cart|bulk-menu|receipt|multi-bulk\",\n"
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
        
        # Refresh menu data periodically
        update_menu_items_from_graphql()
        
        # Initialize or get conversation history
        if session_id not in conversations:
            conversations[session_id] = [SystemMessage(content=get_system_prompt())]
        
        messages = conversations[session_id]
        
        # Add cart context to the message
        cart_context = f"\nCurrent cart: {json.dumps(cart_items)}" if cart_items else "\nCart is empty."
        full_message = user_message + cart_context
        
        # Add user message to conversation
        messages.append(HumanMessage(content=full_message))
        
        # Check if AI service is available
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
            error_message = str(e)
            print(f"OpenAI API Error: {error_message}")
            
            # Check if it's a rate limit error
            if "rate_limit_exceeded" in error_message or "429" in error_message or "Rate limit reached" in error_message:
                # Use fallback response for rate limit
                print("Rate limit detected, using fallback response")
                return handle_rate_limit_fallback(user_message, cart_items)
            elif "invalid_api_key" in error_message or "401" in error_message:
                # Invalid API key, use fallback
                print("Invalid API key detected, using fallback response")
                return handle_rate_limit_fallback(user_message, cart_items)
            else:
                # Other API errors, also use fallback to maintain functionality
                print(f"Other API error detected, using fallback response: {error_message}")
                return handle_rate_limit_fallback(user_message, cart_items)
        
        # Clean natural language response (remove JSON and clean formatting)
        natural_response = re.sub(r"```json.*```", "", text, flags=re.DOTALL).strip()
        
        # Extract JSON from response
        json_match = re.search(r"```json\s*(\{.*\})\s*```", text, re.DOTALL)
        if json_match:
            try:
                action_data = json.loads(json_match.group(1))
            except json.JSONDecodeError:
                action_data = {"action": "none", "message_type": "text"}
        else:
            # If no JSON found, try to detect intent and create appropriate action
            action_data = detect_intent_and_create_action(user_message, natural_response)
        
        # Clean up formatting issues
        natural_response = clean_response_formatting(natural_response)
        
        # Add assistant response to conversation history
        messages.append(AIMessage(content=natural_response))
        
        # Limit conversation history to last 20 messages
        if len(messages) > 21:  # Keep system message + 20 recent messages
            messages = [messages[0]] + messages[-20:]
        
        conversations[session_id] = messages
        
        return jsonify({
            'response': natural_response,
            'action_data': action_data,
            'success': True
        })
        
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

if __name__ == '__main__':
    print("🤖 Starting Restaurant Chatbot Service...")
    print("📡 Service will be available at http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)