import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

load_dotenv()

# Test different model names
models_to_test = [
    "gpt-4o",
    "gpt-4o-mini", 
    "gpt-3.5-turbo"
]

base_url = os.getenv("OPENAI_BASE_URL")
api_key = os.getenv("GITHUB_TOKEN")

print(f"Base URL: {base_url}")
print(f"API Key (first 20 chars): {api_key[:20]}..." if api_key else "No API Key")

for model in models_to_test:
    try:
        print(f"\n--- Testing model: {model} ---")
        llm = ChatOpenAI(
            model=model,
            temperature=0.2,
            base_url=base_url,
            api_key=api_key
        )
        
        # Test with a simple message
        response = llm.invoke([HumanMessage(content="Hello, just say 'Hi' back.")])
        print(f"✅ SUCCESS: {response.content}")
        break  # If successful, stop testing other models
        
    except Exception as e:
        print(f"❌ FAILED: {e}")

print("\nDone testing models.")