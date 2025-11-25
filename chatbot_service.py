import os, re, json, time, random, requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from dotenv import load_dotenv
from typing import List, Dict, Optional, Any

load_dotenv()

# Configuration
GRAPHQL_URL = "http://localhost:4000/graphql"
MENU_ITEMS, MENU_CATEGORIES, MENU_DATA_CACHE = [], [], {}
LAST_FETCH_TIME, CACHE_DURATION = 0, 300

# GraphQL Functions
def fetch_menu_data_from_graphql() -> Optional[Dict[str, Any]]:
    global LAST_FETCH_TIME, MENU_DATA_CACHE
    if time.time() - LAST_FETCH_TIME < CACHE_DURATION and MENU_DATA_CACHE:
        return MENU_DATA_CACHE
    
    query = "query { menuItems { id name description price category available ingredients } }"
    try:
        response = requests.post(GRAPHQL_URL, json={'query': query}, headers={'Content-Type': 'application/json'}, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'data' in data and 'menuItems' in data['data']:
                menu_items = data['data']['menuItems']
                MENU_DATA_CACHE = {
                    'items': menu_items,
                    'categories': list(set(item['category'] for item in menu_items if item['available']))
                }
                LAST_FETCH_TIME = time.time()
                print(f"✅ Fetched {len(menu_items)} menu items from GraphQL")
                return MENU_DATA_CACHE
    except Exception as e:
        print(f"❌ GraphQL error: {e}")
    return None

def update_menu_items_from_graphql():
    global MENU_ITEMS, MENU_CATEGORIES
    menu_data = fetch_menu_data_from_graphql()
    if menu_data:
        MENU_ITEMS = [item['name'] for item in menu_data['items'] if item['available']]
        MENU_CATEGORIES = menu_data['categories']
        print(f"🔄 Updated menu: {len(MENU_ITEMS)} items across {len(MENU_CATEGORIES)} categories")
        return True
    else:
        MENU_ITEMS = ["Margherita Pizza", "Pepperoni Pizza", "BBQ Chicken Pizza", "Veggie Supreme Pizza",
                      "Caesar Salad", "Greek Salad", "Garden Salad", "Chicken Caesar Salad",
                      "Spaghetti Carbonara", "Penne Arrabbiata", "Fettuccine Alfredo", "Lasagna",
                      "Grilled Salmon", "Grilled Shrimp", "Fish and Chips", "Seafood Platter",
                      "Grilled Chicken Breast", "Beef Burger", "Veggie Burger", "Steak",
                      "Garlic Bread", "Mozzarella Sticks", "Chicken Wings", "Onion Rings", "Bruschetta",
                      "Chocolate Cake", "Tiramisu", "Ice Cream", "Cheesecake",
                      "Coca Cola", "Pepsi", "Orange Juice", "Apple Juice", "Water", "Coffee", "Tea"]
        MENU_CATEGORIES = ["Pizza", "Pasta", "Salads", "Seafood", "Main Courses", "Appetizers", "Desserts", "Beverages"]
        return False

def get_menu_item_details(item_name: str) -> Optional[Dict]:
    menu_data = fetch_menu_data_from_graphql()
    if menu_data:
        for item in menu_data['items']:
            if item['name'].lower() == item_name.lower() and item['available']:
                return item
    return None

def find_menu_item_fuzzy_with_details(search_term: str) -> Optional[Dict]:
    search_term = search_term.lower().strip()
    menu_data = fetch_menu_data_from_graphql()
    
    if not menu_data:
        matched_name = find_menu_item_fuzzy(search_term)
        return {'name': matched_name, 'price': 12.99} if matched_name else None
    
    # Exact match
    for item in menu_data['items']:
        if item['available'] and item['name'].lower() == search_term:
            return item
    
    # Partial match
    for item in menu_data['items']:
        if item['available'] and (search_term in item['name'].lower() or item['name'].lower() in search_term):
            return item
    
    # Space-normalized match
    search_normalized = search_term.replace(' ', '')
    for item in menu_data['items']:
        if item['available'] and item['name'].lower().replace(' ', '') == search_normalized:
            return item
    
    # Synonyms
    synonyms = {'apple juice can': 'Apple Juice Can', 'fresh orange juice': 'Fresh Orange Juice',
                'water bottle': 'Water Bottle', 'coke': 'Coca Cola', 'pepsi cola': 'Pepsi',
                'orange': 'Fresh Orange Juice', 'apple': 'Apple Juice Can'}
    
    if search_term in synonyms:
        for item in menu_data['items']:
            if item['available'] and item['name'].lower() == synonyms[search_term].lower():
                return item
    return None

def find_menu_item_fuzzy(search_term):
    result = find_menu_item_fuzzy_with_details(search_term)
    return result['name'] if result else None

# Flask App Setup
app = Flask(__name__)
CORS(app)

print("Initializing menu data from GraphQL...")
update_menu_items_from_graphql()

# OpenAI Setup
try:
    base_url = os.getenv("OPENAI_BASE_URL")
    api_key = os.getenv("GITHUB_TOKEN") or os.getenv("OPENAI_API_KEY")
    use_fallback = api_key in ["fallback_mode", "your-openai-api-key-here", None, ""]
    
    if not use_fallback:
        model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini").replace("openai/", "")
        print(f"[INIT] Initializing AI model: {model_name}")
        llm = ChatOpenAI(model=model_name, temperature=float(os.getenv("OPENAI_TEMPERATURE", "0.2")),
                        base_url=base_url, api_key=api_key, request_timeout=15.0)
        print("[INIT] ✅ AI model initialized successfully")
    else:
        llm = None
        print("[INIT] Running in FALLBACK MODE (rule-based responses, no AI API)")
except Exception as e:
    print(f"[INIT] Error: {e}")
    llm = None

conversations = {}

# Utility Functions
def clean_response_formatting(text):
    if not text: return text
    cleaned = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    cleaned = re.sub(r'\*(.*?)\*', r'\1', cleaned)
    cleaned = re.sub(r'#{1,6}\s*', '', cleaned)
    cleaned = re.sub(r'```[^`]*```', '', cleaned)
    cleaned = re.sub(r'`([^`]*)`', r'\1', cleaned)
    cleaned = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', cleaned)
    cleaned = re.sub(r'\*{2,}', '', cleaned)
    cleaned = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned)
    return cleaned.strip()

def _make_human_comment_for_item(item: Dict[str, Any], emotional_state: Dict = None) -> str:
    if not item: return "A great choice — many customers love this!"
    category = item.get('category', '').lower()
    emotion = emotional_state.get('emotion', 'neutral') if emotional_state else 'neutral'
    
    if emotion in ['very_negative', 'negative', 'crisis']:
        if 'dessert' in category: return "Sometimes a little sweetness can bring comfort during tough times."
        if 'pizza' in category: return "Warm, cheesy comfort food that feels like a hug."
        if 'pasta' in category: return "Warm, hearty, and comforting — like a bowl of love."
    elif emotion == 'positive':
        if 'dessert' in category: return "Perfect for celebrating! Life's good moments deserve something sweet."
    
    desc = item.get('description') or (', '.join(item.get('ingredients', [])) if item.get('ingredients') else '')
    if desc:
        first_sentence = desc.split('.')[0].strip()
        if first_sentence: return f"{first_sentence.capitalize()}. A popular pick!"
    
    comments = {
        'pizza': "Cheesy, flavorful and perfect to share — a crowd favorite!",
        'salad': "Fresh and crisp — great if you're craving something light.",
        'dessert': "Sweet finish — customers often save room for this.",
        'seafood': "Delicately seasoned and cooked to perfection.",
        'beverage': "Refreshing and pairs well with meals."
    }
    return comments.get(category, "A tasty choice — many customers enjoy this!")

def detect_emotional_state(user_message):
    lower_message = user_message.lower()
    emotional_indicators = {
        'very_negative': {'keywords': ['devastated', 'destroyed', 'ruined', 'hopeless', 'suicide', 'kill myself'], 'intensity': 'very_high', 'emotion': 'crisis'},
        'negative_high': {'keywords': ['worst day ever', 'horrible', 'terrible', 'awful', 'miserable', 'depressed'], 'intensity': 'high', 'emotion': 'very_negative'},
        'negative_medium': {'keywords': ['sad', 'upset', 'angry', 'frustrated', 'disappointed', 'stressed'], 'intensity': 'medium', 'emotion': 'negative'},
        'positive': {'keywords': ['happy', 'great', 'awesome', 'fantastic', 'wonderful', 'excited'], 'intensity': 'high', 'emotion': 'positive'},
        'celebratory': {'keywords': ['celebrating', 'birthday', 'anniversary', 'promotion'], 'intensity': 'high', 'emotion': 'celebratory'},
        'lonely': {'keywords': ['alone', 'lonely', 'no one cares', 'by myself'], 'intensity': 'medium', 'emotion': 'lonely'},
    }
    
    detected_emotions = []
    for category, data in emotional_indicators.items():
        for keyword in data['keywords']:
            if keyword in lower_message:
                detected_emotions.append({'category': category, 'keyword': keyword, 'intensity': data['intensity'], 'emotion': data['emotion']})
    
    if detected_emotions:
        intensity_order = {'very_high': 4, 'high': 3, 'medium': 2, 'low': 1}
        detected_emotions.sort(key=lambda x: intensity_order.get(x['intensity'], 0), reverse=True)
        return detected_emotions[0]
    return {'emotion': 'neutral', 'intensity': 'none', 'category': 'neutral'}

def generate_empathetic_response(emotional_state, user_name=None, context='greeting'):
    emotion = emotional_state.get('emotion', 'neutral')
    name_prefix = f"{user_name}, " if user_name else ""
    
    responses = {
        'crisis': f"I'm deeply concerned about you, {name_prefix}and I want you to know that you matter. Please reach out to someone you trust.",
        'very_negative': f"I'm so sorry you're going through such a tough time, {name_prefix}Would you like something comforting from our menu?",
        'negative': f"I'm sorry you're not feeling your best today, {name_prefix}What sounds good to you right now?",
        'lonely': f"You're not alone right now, {name_prefix}I'm here with you. Tell me what sounds good?",
        'positive': f"I love your positive energy, {name_prefix}What delicious food would make your day even better?",
        'celebratory': f"Congratulations, {name_prefix}That's fantastic news! What would make this celebration perfect?",
    }
    
    return responses.get(emotion, f"Hello, {user_name}! I'm here to help you find something delicious." if user_name else "Hello! How can I help you today?")

def detect_intent_and_create_action(user_message, response_text):
    lower_message = re.sub(r'[.,!?]', '', user_message.lower()).strip()
    print(f"🔍 Analyzing message: '{user_message}'")
    
    # Greeting
    if any(greet in lower_message for greet in ['hi', 'hello', 'hey', 'hiya', 'good morning']):
        name_match = re.search(r'^(?:hi|hello|hey)[,!\s]*(?:i\'m\s+|i am\s+)?([A-Za-z][A-Za-z\-]{0,30})', user_message, re.IGNORECASE)
        name = name_match.group(1).strip().capitalize() if name_match else None
        emotional_state = detect_emotional_state(user_message)
        response_text = generate_empathetic_response(emotional_state, name, 'greeting')
        return {"action": "greeting", "message_type": "text", "greeting_name": name, "emotional_state": emotional_state, "response_text": response_text, "response_delay": 800}
    
    # Clear chat
    if any(phrase in lower_message for phrase in ['clear chat', 'clear conversation', 'reset chat']):
        return {"action": "clear_chat", "message_type": "text", "response_delay": 500}
    
    # Show cart
    if any(phrase in lower_message for phrase in ['show my cart', 'show cart', 'view cart', 'my cart']):
        return {"action": "show_cart", "message_type": "text", "response_delay": 1000}
    
    # Remove all
    remove_all_patterns = [r'\b(?:remove|delete|cancel)\s+all\s+(?:of\s+)?(?:the\s+)?([a-zA-Z0-9\s]+)(?:\s+from\s+cart)?']
    for pattern in remove_all_patterns:
        match = re.search(pattern, lower_message, re.IGNORECASE)
        if match:
            item_name = re.sub(r'\b(?:please|plz|now|thanks)\b', '', match.group(1), flags=re.IGNORECASE).strip()
            item_details = find_menu_item_fuzzy_with_details(item_name)
            if item_details:
                return {"action": "remove_all", "message_type": "text", "target_item": item_details['name'], "response_delay": 1000}
    
    # Remove with quantity
    remove_patterns = [
        r'\b(?:remove|delete)\s+(?:the\s+)?(\d+)\s+quantity\s+of\s+([a-zA-Z\s]+)',
        r'\b(?:remove|delete)\s+the\s+(\d+)\s+(.+?)(?:\s+from\s+cart)?(?:\s|$)',
        r'\b(?:remove|delete|cancel)\s+(\d+)\s+(?!quantity\s+of)(.+?)(?:\s*$)',
    ]
    for pattern in remove_patterns:
        match = re.search(pattern, lower_message, re.IGNORECASE)
        if match:
            quantity = int(match.group(1))
            item_name = match.group(2).strip()
            item_details = find_menu_item_fuzzy_with_details(item_name)
            if item_details:
                return {"action": "update", "message_type": "text", "operation": "decrease", "target_item": item_details['name'], "quantity": quantity, "response_delay": 1000}
    
    # Place order
    if any(phrase in lower_message for phrase in ['place order', 'checkout', 'order now']):
        return {"action": "place_order", "message_type": "text", "order_id": f"ORD-{int(time.time())}", "response_delay": 1500}
    
    # Add items
    direct_item_patterns = [
        r'\b(?:add)\s+(?!more\b)(\d+)\s+([a-zA-Z\s]+)',
        r'\bi\s+want\s+(?!(to\s+order\s*$))(\d+)\s+(?:of\s+)?([a-zA-Z\s]+)',
        r'\border\s+(\d+)\s+([a-zA-Z\s]+)',
    ]
    for pattern in direct_item_patterns:
        match = re.search(pattern, lower_message, re.IGNORECASE)
        if match:
            quantity = int(match.group(1))
            item_name = match.group(2).strip()
            item_details = find_menu_item_fuzzy_with_details(item_name)
            if item_details:
                emotional_state = detect_emotional_state(user_message)
                return {"action": "add", "message_type": "text", "items": [{"name": item_details['name'], "quantity": quantity, "price": item_details.get('price', 12.99), "id": item_details.get('id', f"item-{quantity}"), "human_comment": _make_human_comment_for_item(item_details, emotional_state)}], "emotional_context": emotional_state, "response_delay": 1000}
    
    return {"action": "none", "message_type": "text"}

def handle_rate_limit_fallback(user_message, cart_items):
    lower_message = user_message.lower()
    response = "I'm currently experiencing high demand, but I can still help you! What would you like to order?"
    
    if any(greeting in lower_message for greeting in ['hi', 'hello', 'hey']):
        emotional_state = detect_emotional_state(user_message)
        response = generate_empathetic_response(emotional_state, None, 'greeting')
    
    action_data = detect_intent_and_create_action(user_message, "")
    
    if action_data['action'] == 'show_cart':
        response = "Your cart is currently empty." if not cart_items else f"You have {sum(item.get('quantity', 1) for item in cart_items)} items in your cart."
    elif action_data['action'] == 'place_order':
        response = "Your cart is empty." if not cart_items else "Perfect! I'll process your order."
    
    return jsonify({'response': response, 'action_data': action_data, 'success': True, 'fallback_mode': True})

def get_system_prompt():
    update_menu_items_from_graphql()
    menu_items_str = ', '.join(MENU_ITEMS) if MENU_ITEMS else 'Loading menu items...'
    categories_str = ', '.join(MENU_CATEGORIES) if MENU_CATEGORIES else 'Loading categories...'
    
    return (
        f"You are a friendly restaurant ordering assistant.\n"
        f"Valid menu items: {menu_items_str}.\n"
        f"Categories: {categories_str}.\n\n"
        "Capabilities: Browse menu, add/remove items, modify cart, show cart, place orders, emotional intelligence.\n"
        "Rules:\n"
        "- ALWAYS provide JSON actions for UI rendering\n"
        "- Keep text responses SHORT\n"
        "- ALWAYS end with properly formatted JSON block\n"
        "- Detect emotional state and adapt tone\n"
        "- Show empathy and care\n\n"
        "Example JSON format:\n"
        "```json\n"
        '{"action": "add|remove|show_cart|place_order", "items": [{"name": "item_name", "quantity": number}], "message_type": "text", "response_delay": 1000}\n'
        "```"
    )

def extract_json_from_text(text: str):
    if not text: return None, text
    
    # Fenced JSON block
    m = re.search(r"```json\s*(\{[\s\S]*\})\s*```", text, flags=re.IGNORECASE)
    if m:
        try:
            obj = json.loads(m.group(1))
            cleaned = text[:m.start()] + text[m.end():]
            return obj, cleaned.strip()
        except: pass
    
    # Inline JSON
    start = text.find('{')
    if start != -1:
        stack = []
        for i in range(start, len(text)):
            if text[i] == '{': stack.append('{')
            elif text[i] == '}':
                if stack:
                    stack.pop()
                    if not stack:
                        try:
                            obj = json.loads(text[start:i+1])
                            cleaned = text[:start] + text[i+1:]
                            return obj, cleaned.strip()
                        except: break
    return None, text

def extract_items_from_text(text):
    if not text: return []
    
    word_to_number = {'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5', 'a': '1', 'an': '1'}
    for word, digit in word_to_number.items():
        text = re.sub(r'\b' + word + r'\b', digit, text, flags=re.I)
    
    if any(indicator in text.lower() for indicator in ['remove', 'delete', 'cancel', 'decrease']):
        return []
    
    items = []
    for m in re.finditer(r'(\d+)\s+(?:more\s+)?([A-Za-z0-9&\'\-\s]+?)(?=(?:\s+(?:and|,|&)\s+\d|\s*$|[.,!?]))', text, re.I):
        qty = int(m.group(1))
        name = m.group(2).strip().rstrip('.,!?')
        if name: items.append({'name': name, 'quantity': qty})
    
    return items

def extract_remove_items_from_text(text):
    if not text: return []
    
    word_to_number = {'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5', 'a': '1', 'an': '1'}
    text_lower = text.lower()
    for word, number in word_to_number.items():
        text_lower = re.sub(r'\b' + word + r'\b', number, text_lower)
    
    operation = None
    if any(indicator in text_lower for indicator in ['remove', 'delete', 'cancel']): operation = 'remove'
    elif any(indicator in text_lower for indicator in ['decrease', 'reduce']): operation = 'decrease'
    elif any(indicator in text_lower for indicator in ['increase', 'add more']): operation = 'increase'
    else: return []
    
    extracted_items = []
    patterns = [
        r'(?:remove|delete|decrease|increase)\s+(\d+)\s+(?:more\s+)?(.+?)(?:\s+by\s+\d+)?(?:\s+and|$)',
        r'(?:remove|delete|decrease|increase)\s+(?:more\s+)?(.+?)\s+by\s+(\d+)',
    ]
    
    for pattern in patterns:
        matches = re.finditer(pattern, text_lower, re.IGNORECASE)
        for match in matches:
            groups = match.groups()
            if len(groups) == 2 and groups[0].isdigit():
                quantity, item_name = int(groups[0]), groups[1].strip()
            elif len(groups) == 2 and groups[1].isdigit():
                item_name, quantity = groups[0].strip(), int(groups[1])
            else:
                quantity, item_name = 1, groups[0].strip() if groups else ''
            
            if item_name:
                extracted_items.append({'name': item_name, 'quantity': quantity, 'operation': operation})
                break
    
    return extracted_items

# Routes
@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'response': "Invalid request data", 'action_data': {"action": "none", "message_type": "text"}, 'success': False}), 400

        user_message = data.get('message', '')
        session_id = data.get('session_id', 'default')
        cart_items = data.get('cart_items', [])

        update_menu_items_from_graphql()

        # Early intent detection
        local_items = extract_items_from_text(user_message)
        if local_items:
            items_out = []
            for it in local_items:
                details = find_menu_item_fuzzy_with_details(it['name']) or {'name': it['name'], 'price': 0.0}
                items_out.append({'name': details.get('name', it['name']), 'quantity': int(it.get('quantity', 1)), 'price': details.get('price', 0.0), 'id': details.get('id', f"item-{int(time.time())}"), 'human_comment': _make_human_comment_for_item(details)})

            action = 'add_multiple' if len(items_out) > 1 else 'add'
            if action == 'add_multiple':
                item_list = ', '.join([f"{i['quantity']} {i['name']}" for i in items_out])
                resp_text = f"Great - adding {item_list} to your cart."
            else:
                resp_text = f"Great - adding {items_out[0]['quantity']} {items_out[0]['name']} to your cart."
            return jsonify({'response': resp_text, 'action_data': {'action': action, 'items': items_out, 'message_type': 'text', 'response_delay': 800}, 'success': True})

        early_action = detect_intent_and_create_action(user_message, "")
        if early_action and early_action.get('action') != 'none':
            if early_action.get('action') == 'greeting':
                return jsonify({'response': early_action.get('response_text', 'Hello!'), 'action_data': {**early_action, 'message_type': 'text'}, 'success': True})
            
            response_text = ''
            action_type = early_action.get('action')
            if action_type == 'remove_all': response_text = f"Sure - removing all {early_action.get('target_item', 'items')} from your cart."
            elif action_type == 'show_cart': response_text = "Here's what's in your cart."
            elif action_type == 'place_order': response_text = "Let me prepare your order."
            
            return jsonify({'response': response_text, 'action_data': {**early_action, 'message_type': 'text'}, 'success': True})

        # Initialize conversation
        if session_id not in conversations:
            conversations[session_id] = [SystemMessage(content=get_system_prompt())]

        messages = conversations[session_id]
        cart_context = f"\nCurrent cart: {json.dumps(cart_items)}" if cart_items else "\nCart is empty."
        messages.append(HumanMessage(content=user_message + cart_context))

        if llm is None:
            return jsonify({'response': "AI service is not available.", 'action_data': {"action": "none", "message_type": "text"}, 'success': False}), 503

        # Get AI response from OpenAI
        try:
            print(f"[AI] Invoking OpenAI LLM for session {session_id}...")
            response = llm.invoke(messages)
            text = str(response.content).strip() if hasattr(response, 'content') else ""
            print(f"[AI] ✅ Response received from OpenAI successfully")
        except Exception as e:
            print(f"❌ OpenAI API Error: {e}")
            if any(err in str(e).lower() for err in ["timeout", "rate_limit", "429"]):
                return handle_rate_limit_fallback(user_message, cart_items)

        # Extract JSON from response
        extracted_json, cleaned_text = extract_json_from_text(text)
        action_data = extracted_json if extracted_json else detect_intent_and_create_action(user_message, text)
        if action_data: action_data['message_type'] = 'text'
        natural_response = clean_response_formatting(cleaned_text)

        messages.append(AIMessage(content=natural_response))
        if len(messages) > 21: messages = [messages[0]] + messages[-20:]
        conversations[session_id] = messages

        return jsonify({'response': natural_response, 'action_data': action_data or {"action": "none", "message_type": "text"}, 'success': True})

    except Exception as e:
        return jsonify({'response': "I'm sorry, I encountered an error.", 'action_data': {"action": "none", "message_type": "text"}, 'success': False, 'error': str(e)}), 500

@app.route('/clear_session', methods=['POST'])
def clear_session():
    try:
        data = request.get_json()
        session_id = data.get('session_id', 'default') if data else 'default'
        if session_id in conversations:
            conversations[session_id] = [SystemMessage(content=get_system_prompt())]
        return jsonify({'success': True, 'message': 'Chat cleared! How can I help you today?'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    ai_status = "ready" if llm is not None else "api_key_required"
    return jsonify({'status': 'healthy', 'service': 'chatbot', 'ai_status': ai_status, 'message': 'AI service ready' if llm else 'Please configure OpenAI API key', 'fallback_available': True})

@app.route('/menu', methods=['GET'])
def get_menu_info():
    try:
        success = update_menu_items_from_graphql()
        return jsonify({'success': True, 'items': MENU_ITEMS, 'categories': MENU_CATEGORIES, 'total_items': len(MENU_ITEMS), 'total_categories': len(MENU_CATEGORIES), 'data_source': 'GraphQL' if success else 'Fallback', 'last_updated': LAST_FETCH_TIME})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'items': [], 'categories': []}), 500

@app.route('/menu/refresh', methods=['POST'])
def refresh_menu_data():
    try:
        global LAST_FETCH_TIME
        LAST_FETCH_TIME = 0
        success = update_menu_items_from_graphql()
        return jsonify({'success': success, 'message': 'Menu data refreshed successfully' if success else 'Failed to refresh', 'items_count': len(MENU_ITEMS), 'categories_count': len(MENU_CATEGORIES), 'data_source': 'GraphQL' if success else 'Fallback'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    print("[CHATBOT] Starting Restaurant Chatbot Service...")
    print("📡 Service available at http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
