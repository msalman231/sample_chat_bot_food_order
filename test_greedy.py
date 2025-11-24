
import re

def test_regex_greedy_vs_nongreedy():
    text = "remove all pepperoni pizza"
    
    # Current non-greedy pattern
    nongreedy = r'\b(?:remove|delete|cancel|take\s+out)\s+all\s+(?:of\s+)?(?:the\s+)?([a-zA-Z0-9\s]+?)(?:\s+from\s+cart)?(?:\s|$)'
    
    # Proposed greedy pattern
    greedy = r'\b(?:remove|delete|cancel|take\s+out)\s+all\s+(?:of\s+)?(?:the\s+)?([a-zA-Z0-9\s]+)(?:\s+from\s+cart)?(?:\s|$)'
    
    print(f"Text: '{text}'")
    
    m1 = re.search(nongreedy, text, re.IGNORECASE)
    if m1:
        print(f"Non-greedy match: '{m1.group(0)}'")
        print(f"Non-greedy group 1: '{m1.group(1)}'")
    else:
        print("Non-greedy: No match")
        
    m2 = re.search(greedy, text, re.IGNORECASE)
    if m2:
        print(f"Greedy match: '{m2.group(0)}'")
        print(f"Greedy group 1: '{m2.group(1)}'")
    else:
        print("Greedy: No match")

test_regex_greedy_vs_nongreedy()
