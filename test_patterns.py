import re

# Test messages
test_messages = [
    'remove pizza',
    'remove 2 pizzas', 
    'decrease pizza by 1',
    'reduce pizza quantity by 2',
    'delete 1 pizza from cart',
    'take out pizza'
]

# Current patterns from code
remove_patterns = [
    r'\b(?:remove|delete|cancel|take\s+out)\s+(?:(\d+)\s+)?([a-zA-Z\s]+?)(?:\s|$)',
    r'\b(?:remove|delete)\s+([a-zA-Z\s]+?)\s+by\s+(\d+)\b',
    r'\btake\s+out\s+(?:(\d+)\s+)?([a-zA-Z\s]+?)(?:\s|$)'
]

decrease_patterns = [
    r'\b(?:decrease|reduce)\s+([a-zA-Z\s]+?)\s+(?:by\s+)?(\d+)\b',
    r'\b(?:decrease|reduce)\s+(?:the\s+)?([a-zA-Z\s]+?)\s+(?:by\s+)?(\d+)\b'
]

direct_item_patterns = [
    r'\b(?:add)\s+(?!more\b)(\d+)\s+([a-zA-Z\s]+?)(?:\s|$)',
    r'\b(?:add)\s+(?!more\b)(?!\d+\s+more\b)([a-zA-Z\s]+?)(?:\s|$)'
]

print('Testing messages...')
for msg in test_messages:
    print(f'\n--- Testing: "{msg}" ---')
    lower_msg = msg.lower()
    
    # Test remove patterns
    found_remove = False
    for i, pattern in enumerate(remove_patterns):
        match = re.search(pattern, lower_msg, re.IGNORECASE)
        if match:
            print(f'✅ Remove pattern {i+1} matched: {match.groups()}')
            found_remove = True
            break
    
    # Test decrease patterns
    found_decrease = False
    for i, pattern in enumerate(decrease_patterns):
        match = re.search(pattern, lower_msg, re.IGNORECASE)
        if match:
            print(f'✅ Decrease pattern {i+1} matched: {match.groups()}')
            found_decrease = True
            break
    
    # Test add patterns (to see if there's conflict)
    found_add = False
    for i, pattern in enumerate(direct_item_patterns):
        match = re.search(pattern, lower_msg, re.IGNORECASE)
        if match:
            print(f'⚠️  ADD pattern {i+1} also matched: {match.groups()}')
            found_add = True
    
    if not found_remove and not found_decrease:
        print('❌ No remove/decrease patterns matched')