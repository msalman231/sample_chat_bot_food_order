import re

# Test the exact message from the screenshot
test_messages = [
    'Remove the 1 quantity of Tiramisu',
    'Remove 1 quantity of Tiramisu',
    'Remove Tiramisu',
    'Remove 2 pizza',
    'Remove the pizza'
]

# Updated remove patterns - in priority order
remove_patterns = [
    r'\b(?:remove|delete)\s+(?:the\s+)?(\d+)\s+quantity\s+of\s+([a-zA-Z\s]+?)(?:\s|$)',
    r'\b(?:remove|delete)\s+([a-zA-Z\s]+?)\s+by\s+(\d+)\b',
    r'\b(?:remove|delete|cancel|take\s+out)\s+(\d+)\s+(?!quantity\s+of)([a-zA-Z\s]+?)(?:\s|$)',
    r'\b(?:remove|delete|cancel)\s+the\s+([a-zA-Z\s]+?)(?:\s+from\s+cart)?(?:\s|$)',
    r'\b(?:remove|delete|cancel)\s+([a-zA-Z\s]+?)(?:\s+from\s+cart)?(?:\s|$)',
    r'\btake\s+out\s+(?:(\d+)\s+)?([a-zA-Z\s]+?)(?:\s|$)'
]

for test_message in test_messages:
    lower_message = test_message.lower()
    print(f'\n=== Testing: "{test_message}" ===')
    
    found_match = False
    for i, pattern in enumerate(remove_patterns):
        match = re.search(pattern, lower_message, re.IGNORECASE)
        if match:
            print(f'✅ Remove pattern {i+1} MATCHED: {match.groups()}')
            print(f'   Pattern: {pattern}')
            print(f'   Full match: "{match.group(0)}"')
            
            # Simulate the NEW logic from chatbot_service.py
            if 'quantity\\s+of' in pattern:
                quantity = int(match.group(1))
                item_name = match.group(2).strip()
            elif 'by' in pattern:
                item_name = match.group(1).strip()
                quantity = int(match.group(2))
            elif r'(\d+)\s+(?!quantity\s+of)' in pattern:
                quantity = int(match.group(1))
                item_name = match.group(2).strip()
            elif 'take\\s+out' in pattern and len(match.groups()) == 2:
                quantity_str = match.group(1)
                item_name = match.group(2).strip()
                quantity = int(quantity_str) if quantity_str else 1
            else:
                item_name = match.group(1).strip() if match.group(1) else ""
                quantity = 1
            
            print(f'   → Item: "{item_name}", Quantity: {quantity}')
            found_match = True
            break
    
    if not found_match:
        print('❌ No remove patterns matched')