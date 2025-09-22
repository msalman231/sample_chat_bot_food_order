# 🤖 AI-Powered Restaurant Chatbot

This restaurant website now features an intelligent AI chatbot powered by OpenAI's GPT-4o-mini model using LangChain. The chatbot provides natural, context-aware conversations for ordering food.

## ✨ AI Features

### 🧠 **Natural Language Understanding**
- Understands natural speech patterns and colloquial language
- Context-aware responses based on conversation history
- Intelligent intent recognition for ordering, browsing, and cart management

### 🍕 **Smart Menu Assistance**
- Intelligent menu recommendations based on user preferences
- Category-aware browsing with contextual suggestions
- Automatic quantity handling and bulk order management

### 🛒 **Advanced Cart Management**
- Natural language cart modifications ("increase pizza by 2")
- Smart item removal ("remove all pizzas")
- Context-aware quantity adjustments

### 🔄 **Fallback Support**
- Graceful degradation when AI service is unavailable
- Hybrid approach with hardcoded fallbacks for critical functions
- Real-time service status monitoring

## 🚀 Setup Instructions

### Prerequisites
- **Python 3.8+** with pip
- **Node.js 18+** with npm
- **OpenAI API Key** (required for AI features)

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt
```

### 2. Configure OpenAI API Key

The API key is currently hardcoded in `chatbot_service.py` for demo purposes. For production:

1. Create a `.env` file:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

2. Update `chatbot_service.py` to use environment variables:
```python
from dotenv import load_dotenv
load_dotenv()

if "OPENAI_API_KEY" not in os.environ:
    raise ValueError("OPENAI_API_KEY not found in environment variables")
```

### 3. Start All Services

#### Option A: Using Startup Scripts
```bash
# On Windows
start_with_ai.bat

# On Linux/Mac
./start_with_ai.sh
```

#### Option B: Manual Startup
```bash
# Terminal 1: Start AI Chatbot Service
python chatbot_service.py

# Terminal 2: Start GraphQL Server  
npm run dev:server

# Terminal 3: Start React Frontend
npm run dev
```

#### Option C: Using NPM Script
```bash
npm run dev:ai
```

## 🌐 Service Endpoints

- **Frontend**: http://localhost:5173
- **GraphQL API**: http://localhost:4000/graphql
- **AI Chatbot Service**: http://localhost:5000
- **Health Check**: http://localhost:5000/health

## 🛠️ Architecture

### Frontend (React)
- `ChatBot.jsx` - Main chatbot component with AI integration
- Automatic fallback to hardcoded responses if AI unavailable
- Real-time service status indicator
- Session management for conversation continuity

### AI Service (Python + Flask)
- `chatbot_service.py` - Flask API server
- LangChain integration with OpenAI GPT-4o-mini
- Conversation memory and context management
- Structured JSON responses for frontend integration

### Integration Flow
1. User sends message through React chatbot
2. React sends message + cart context to Python AI service
3. AI service processes with LangChain + OpenAI
4. AI returns natural language response + structured actions
5. React processes actions (add/remove items, show menus, etc.)
6. UI updates with AI response and any cart modifications

## 🔧 Configuration

### Menu Items
Update the `MENU_ITEMS` list in `chatbot_service.py` to match your restaurant's menu. The AI will only suggest items from this list.

### AI Model Settings
```python
llm = ChatOpenAI(
    model="gpt-4o-mini",  # Model selection
    temperature=0.2       # Creativity level (0.0-1.0)
)
```

### Response Customization
Modify the `get_system_prompt()` function in `chatbot_service.py` to customize the AI's personality and behavior.

## 🚨 Troubleshooting

### AI Service Issues
- **Connection Error**: Check if Python service is running on port 5000
- **API Key Error**: Verify OpenAI API key is valid and has credits
- **Dependencies**: Ensure all Python packages are installed correctly

### Status Indicators
- 🟢 **Green dot**: AI service connected and operational
- 🟡 **Yellow dot**: Checking AI service status
- 🔴 **Red dot**: AI service unavailable (using fallback responses)

### Fallback Mode
When AI service is unavailable, the chatbot automatically switches to hardcoded responses for basic functionality:
- Menu browsing
- Cart management
- Basic greetings and help

## 📝 Extending the AI

### Adding New Features
1. Update the system prompt in `get_system_prompt()`
2. Add new action types in the JSON response structure
3. Handle new actions in React's `processAIResponse()` function

### Custom Responses
Modify the LangChain prompt engineering to customize:
- Personality and tone
- Domain-specific knowledge
- Response format and structure
- Conversation flow

## 🔒 Security Notes

- **API Key**: Never commit API keys to version control
- **CORS**: Configure CORS settings for production deployment
- **Rate Limiting**: Implement rate limiting for the AI service
- **Input Validation**: Validate user inputs before sending to AI

## 🎯 Future Enhancements

- **Voice Recognition**: Enhanced speech-to-text integration
- **Multi-language Support**: Internationalization with AI translation
- **Personalization**: User preference learning and recommendations
- **Analytics**: Conversation analytics and optimization
- **Integration**: Connect with real POS systems and inventory

---

*This AI chatbot transforms a traditional restaurant website into an intelligent, conversational ordering experience.*
