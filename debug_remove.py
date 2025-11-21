import re

# Test the exact message that's failing
test_message = 'remove 1 fish and chips'
lower_message = test_message.lower()

print(f'Testing message: "{test_message}"')
print(f'Lower case: "{lower_message}"')

# Updated remove patterns with greedy matching
remove_patterns = [
    r'\b(?:remove|delete)\s+(?:the\s+)?(\d+)\s+quantity\s+of\s+([a-zA-Z\s]+?)(?:\s|$)',
    r'\b(?:remove|delete)\s+([a-zA-Z\s]+?)\s+by\s+(\d+)\b',
    r'\b(?:remove|delete|cancel|take\s+out)\s+(\d+)\s+(?!quantity\s+of)(.+?)(?:\s*$)',
    r'\b(?:remove|delete|cancel)\s+the\s+([a-zA-Z\s]+?)(?:\s+from\s+cart)?(?:\s|$)',
    r'\b(?:remove|delete|cancel)\s+(.+?)(?:\s+from\s+cart)?(?:\s*$)',
    r'\btake\s+out\s+(?:(\d+)\s+)?(.+?)(?:\s*$)'
]

print('\n--- Testing Remove Patterns ---')
found_match = False
for i, pattern in enumerate(remove_patterns):
    match = re.search(pattern, lower_message, re.IGNORECASE)
    if match:
        print(f'✅ Remove pattern {i+1} MATCHED: {match.groups()}')
        print(f'   Pattern: {pattern}')
        print(f'   Full match: "{match.group(0)}"')
        
        # Simulate the logic from chatbot_service.py
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
        
        # Determine what action should be returned
        if quantity == 1:
            action = "remove"
            items = [{"name": item_name}]
            print(f'   → Should return: action="remove", items={items}')
        else:
            action = "update" 
            operation = "decrease"
            print(f'   → Should return: action="update", operation="decrease", target_item="{item_name}", quantity={quantity}')
        
        found_match = True
        break

if not found_match:
    print('❌ No remove patterns matched')