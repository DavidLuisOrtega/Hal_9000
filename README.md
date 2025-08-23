# HAL 9000 Chatbot

A secure HAL 9000 AI chatbot with voice capabilities, inspired by 2001: A Space Odyssey.

## Features

- **Secure API Handling**: OpenAI API key is stored securely on the backend
- **Voice Interaction**: Speech recognition and text-to-speech capabilities
- **Character-Accurate Responses**: HAL 9000 personality with progressive system degradation
- **Background Audio**: Immersive Discovery One ambient sounds

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Create a `.env` file in the project root:

```bash
# Copy the example file
cp env.example .env
```

Edit `.env` and add your API keys:

```env
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
PORT=3000

# Optional: ElevenLabs API (for voice features)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

### 3. GitHub Environment Variables (Production)

For deployment, add your environment variables to GitHub:

1. Go to your repository → Settings → Secrets and variables → Actions
2. Add new repository secret: `OPENAI_API_KEY`
3. Add new repository secret: `ELEVENLABS_API_KEY` (optional)

### 4. Run the Application

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Security Features

- ✅ API keys stored securely on backend
- ✅ No sensitive data in frontend code
- ✅ Environment variables for configuration
- ✅ CORS protection
- ✅ Input validation

## File Structure

```
Hal_9000/
├── server.js          # Backend server (Express)
├── package.json       # Dependencies
├── .env              # Environment variables (create this)
├── .gitignore        # Git ignore rules
├── index.html        # Frontend interface
├── script.js         # Frontend logic
├── styles.css        # Styling
└── README.md         # This file
```

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/chat` - Chat with HAL 9000
- `POST /api/tts` - Text-to-speech conversion

## Troubleshooting

- **API Key Issues**: Ensure your `.env` file has the correct API keys
- **Port Conflicts**: Change the PORT in `.env` if 3000 is in use
- **CORS Errors**: The backend includes CORS middleware for local development