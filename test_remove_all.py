
import re

def find_menu_item_fuzzy_with_details(search_term):
    # Mock data
    items = [
        {"name": "Margherita Pizza", "category": "Pizza", "available": True},
        {"name": "Pepperoni Pizza", "category": "Pizza", "available": True},
        {"name": "Coca Cola", "category": "Beverages", "available": True}
    ]
    
    search_term = search_term.lower().strip()
    
    # Exact match
    for item in items:
        if item['name'].lower() == search_term:
            return item
            
    # Partial match
    for item in items:
        if search_term in item['name'].lower():
            return item
            
    return None

def test_remove_all(message):
    lower_message = message.lower()
    print(f"\nTesting: '{message}'")
    
    remove_all_patterns = [
        r'\b(?:remove|delete|cancel|take\s+out)\s+all\s+(?:of\s+)?(?:the\s+)?([a-zA-Z\s]+?)(?:\s+from\s+cart)?(?:\s|$)',
    ]
    
    for pattern in remove_all_patterns:
        match = re.search(pattern, lower_message, re.IGNORECASE)
        if match:
            item_name = match.group(1).strip()
            print(f"Matched pattern: {pattern}")
            print(f"Extracted item name: '{item_name}'")
            
            item_details = find_menu_item_fuzzy_with_details(item_name)
            if item_details:
                print(f"Found item: {item_details['name']}")
                return {
                    "action": "remove_all",
                    "target_item": item_details['name']
                }
            else:
                print(f"Item not found: {item_name}")
    
    print("No 'remove all' match found")
    return None

# Test cases
test_remove_all("remove all margherita pizza")
test_remove_all("remove all the margherita pizza")
test_remove_all("remove all of the margherita pizza")
test_remove_all("remove all pizza") # Should fail if only looking for items, unless "pizza" matches "Margherita Pizza" partially
