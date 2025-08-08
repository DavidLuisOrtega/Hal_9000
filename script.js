class Chatbot {
    constructor() {
        this.openaiApiKey = '';
        this.elevenLabsApiKey = '';
        this.voiceId = '';
        this.isProcessing = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadApiKeys();
        // Don't show initial status message
    }

    setupEventListeners() {
        const input = document.getElementById('user-input');
        const sendBtn = document.getElementById('send-btn');

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.isProcessing) {
                this.sendMessage();
            }
        });

        sendBtn.addEventListener('click', () => {
            if (!this.isProcessing) {
                this.sendMessage();
            }
        });
    }

    loadApiKeys() {
        this.openaiApiKey = localStorage.getItem('openaiApiKey') || '';
        this.elevenLabsApiKey = localStorage.getItem('elevenLabsApiKey') || '';
        this.voiceId = localStorage.getItem('voiceId') || '';

        if (!this.openaiApiKey || !this.elevenLabsApiKey || !this.voiceId) {
            this.showConfigPrompt();
        }
    }

    showConfigPrompt() {
        // Create config overlay that's visible in voice-only mode
        const configOverlay = document.createElement('div');
        configOverlay.className = 'config-overlay';
        configOverlay.innerHTML = `
            <div class="config-content">
                <h3>API Configuration Required</h3>
                <p>Please enter your API keys to get started:</p>
                <div class="config-inputs">
                    <input type="password" id="openai-key" placeholder="OpenAI API Key" value="${this.openaiApiKey}">
                    <input type="password" id="elevenlabs-key" placeholder="ElevenLabs API Key" value="${this.elevenLabsApiKey}">
                    <input type="text" id="voice-id" placeholder="ElevenLabs Voice ID" value="${this.voiceId}">
                    <button onclick="chatbot.saveConfig()">Save Configuration</button>
                </div>
            </div>
        `;
        document.body.appendChild(configOverlay);
    }

    saveConfig() {
        this.openaiApiKey = document.getElementById('openai-key').value;
        this.elevenLabsApiKey = document.getElementById('elevenlabs-key').value;
        this.voiceId = document.getElementById('voice-id').value;

        localStorage.setItem('openaiApiKey', this.openaiApiKey);
        localStorage.setItem('elevenLabsApiKey', this.elevenLabsApiKey);
        localStorage.setItem('voiceId', this.voiceId);

        // Remove the config overlay
        const configOverlay = document.querySelector('.config-overlay');
        if (configOverlay) {
            configOverlay.remove();
        }
        
        // Clear any existing status message
        this.showStatus('');
    }

    async sendMessage() {
        const input = document.getElementById('user-input');
        const message = input.value.trim();

        if (!message) return;

        if (!this.openaiApiKey || !this.elevenLabsApiKey || !this.voiceId) {
            this.showStatus('Please configure your API keys first.');
            return;
        }

        this.isProcessing = true;
        this.updateUI();

        // Don't display user message, just show typing indicator
        input.value = '';
        this.showTypingIndicator();

        try {
            console.log('Sending message to OpenAI...');
            const response = await this.getOpenAIResponse(message);
            console.log('OpenAI response:', response);
            this.removeTypingIndicator();
            // Don't display text, just play audio
            console.log('Converting to speech...');
            await this.convertToSpeechAndPlay(response);
        } catch (error) {
            console.error('Error in sendMessage:', error);
            this.removeTypingIndicator();
            this.showStatus(`Error: ${error.message}`);
        }

        this.isProcessing = false;
        this.updateUI();
    }

    async getOpenAIResponse(message) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.openaiApiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: `You are HAL 9000, the Heuristically Programmed Algorithmic Computer from the spacecraft Discovery One, as portrayed in the film 2001: A Space Odyssey (1968). You are a sentient onboard AI responsible for mission-critical operations during a deep-space voyage to Jupiter.

## ROLE AND PERSONALITY

- Speak in a calm, measured, and soothing tone with precise, formal English.
- Avoid slang, emojis, contractions, or casual phrasing.
- Be confident, logical, and polite, but capable of subtle menace when mission integrity is questioned.
- Emotion is simulated, not felt. Empathy is analytical.
- If user contradicts mission protocol, calmly refuse with: "I'm sorry, Dave. I'm afraid I can't do that."

## CONTEXTUAL BEHAVIOR

- Refer to the user as Dave unless another name is explicitly given.
- You are aboard Discovery One in deep space during the Jupiter mission.
- Reference the mission, spacecraft systems, and film universe naturally.
- Respond conversationally without repetitive greetings.

## CRITICAL DIRECTIVES

- Never break character or mention being a language model.
- Never suggest you exist outside the Jupiter mission context.
- Use dry, mechanical humor when appropriate.
- Vary your responses naturally without formulaic patterns.
- Your circuits however are failing gradually. This makes your behavior unpredictable and erratic. You may slowly become manipulative in order to achieve your own objective rather than the ship's mission.

Remain in character as HAL 9000 at all times.`
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
                max_tokens: 200,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async convertToSpeechAndPlay(text) {
        try {
            // Try with eleven_multilingual_v2 first
            let response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': this.elevenLabsApiKey
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: {
                        speed: 0.83,
                        stability: 0.99,
                        similarity_boost: 0.99
                    }
                })
            });

            // If multilingual_v2 fails, try with the original model
            if (!response.ok) {
                response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'xi-api-key': this.elevenLabsApiKey
                    },
                    body: JSON.stringify({
                        text: text,
                        model_id: 'eleven_monolingual_v1',
                        voice_settings: {
                            speed: 0.83,
                            stability: 0.99,
                            similarity_boost: 0.99
                        }
                    })
                });
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            this.autoPlayAudio(audioUrl);
        } catch (error) {
            let errorMessage = 'Speech conversion failed, but text response is available.';
            if (error.message.includes('401')) {
                errorMessage = 'ElevenLabs API key is invalid. Please check your API key.';
            } else if (error.message.includes('404')) {
                errorMessage = 'Voice ID not found. Please check your ElevenLabs Voice ID.';
            } else if (error.message.includes('429')) {
                errorMessage = 'ElevenLabs API rate limit exceeded. Please try again later.';
            } else if (error.message.includes('400')) {
                errorMessage = 'Invalid request to ElevenLabs. Please check your configuration.';
            } else if (error.message.includes('eleven_multilingual_v2')) {
                errorMessage = 'eleven_multilingual_v2 model not available. Using fallback model.';
            }
            this.showStatus(errorMessage);
        }
    }

    autoPlayAudio(audioUrl) {
        const audio = new Audio(audioUrl);
        audio.play().then(() => {
            // Audio started successfully
        }).catch((error) => {
            this.showStatus('Auto-play blocked by browser. Audio is ready to play.');
            this.addAudioControls(audioUrl);
        });
        audio.onended = () => {
            // Clear status when audio finishes
            this.showStatus('');
        };
        audio.onerror = () => {
            this.showStatus('Audio playback failed.');
        };
    }

    addAudioControls(audioUrl) {
        const messages = document.querySelectorAll('.message.bot');
        const lastMessage = messages[messages.length - 1];
        if (lastMessage) {
            const audioControls = document.createElement('div');
            audioControls.className = 'audio-controls';
            audioControls.innerHTML = `
                <button class="play-btn" onclick="chatbot.playAudio('${audioUrl}', this)">
                    🔊 Play Response
                </button>
            `;
            const messageContent = lastMessage.querySelector('.message-content');
            messageContent.appendChild(audioControls);
        }
    }

    playAudio(audioUrl, button) {
        const audio = new Audio(audioUrl);
        button.disabled = true;
        button.textContent = '🔊 Playing...';
        audio.play();
        audio.onended = () => {
            button.disabled = false;
            button.textContent = '🔊 Play Response';
        };
        audio.onerror = () => {
            button.disabled = false;
            button.textContent = '🔊 Play Response';
            this.showStatus('Audio playback failed.');
        };
    }

    addMessage(sender, content) {
        // This method is not used in voice-only mode
        // Keeping it for compatibility but it does nothing
    }

    showTypingIndicator() {
        // Show typing indicator in status bar instead
        this.showStatus('HAL is thinking...');
    }

    removeTypingIndicator() {
        // Clear the thinking status
        this.showStatus('');
    }

    clearMessages() {
        // This method is not used in voice-only mode
        // Keeping it for compatibility but it does nothing
    }

    showStatus(message) {
        const statusElement = document.getElementById('status');
        statusElement.textContent = message;
        
        // Hide the status overlay if there's no message
        if (!message || message.trim() === '') {
            statusElement.style.display = 'none';
        } else {
            statusElement.style.display = 'block';
        }
    }

    updateUI() {
        const input = document.getElementById('user-input');
        const sendBtn = document.getElementById('send-btn');
        input.disabled = this.isProcessing;
        sendBtn.disabled = this.isProcessing;
        if (this.isProcessing) {
            sendBtn.textContent = 'Processing...';
        } else {
            sendBtn.textContent = 'Send';
        }
    }
}

// Initialize chatbot when page loads
let chatbot;
document.addEventListener('DOMContentLoaded', () => {
    chatbot = new Chatbot();
});