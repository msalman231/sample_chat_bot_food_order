import requests
import os
from dotenv import load_dotenv

load_dotenv()
token = os.getenv('GITHUB_TOKEN')
url = 'https://models.github.ai/inference/models'
headers = {'Authorization': f'Bearer {token}'}

try:
    response = requests.get(url, headers=headers)
    print('Status:', response.status_code)
    if response.status_code == 200:
        models = response.json()
        print('Available models:')
        for model in models.get('data', []):
            print(f"  - {model.get('id', 'N/A')}")
    else:
        print('Response:', response.text)
except Exception as e:
    print('Error:', e)