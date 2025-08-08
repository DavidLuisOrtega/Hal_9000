class Chatbot {
    constructor() {
        this.openaiApiKey = '';
        this.elevenLabsApiKey = 'sk_0ad8934840d686d2a7abab86c98544507d1f90fa00d159e9'; // Hardcoded
        this.voiceId = 'sos6t4F82ZagrStqD8Ra'; // Hardcoded
        this.isProcessing = false;
        this.conversationHistory = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadApiKeys();
        this.loadConversationHistory();
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

        if (!this.openaiApiKey) {
            this.showConfigPrompt();
        }
    }

    loadConversationHistory() {
        const savedHistory = localStorage.getItem('halConversationHistory');
        if (savedHistory) {
            try {
                this.conversationHistory = JSON.parse(savedHistory);
            } catch (e) {
                console.error('Error loading conversation history:', e);
                this.conversationHistory = [];
            }
        }
    }

    saveConversationHistory() {
        try {
            localStorage.setItem('halConversationHistory', JSON.stringify(this.conversationHistory));
        } catch (e) {
            console.error('Error saving conversation history:', e);
        }
    }

    clearConversationHistory() {
        this.conversationHistory = [];
        this.saveConversationHistory();
    }

    showConfigPrompt() {
        // Create config overlay that's visible in voice-only mode
        const configOverlay = document.createElement('div');
        configOverlay.className = 'config-overlay';
        configOverlay.innerHTML = `
            <div class="config-content">
                <h3>API Configuration Required</h3>
                <p>Please enter your OpenAI API key to get started:</p>
                <div class="config-inputs">
                    <input type="password" id="openai-key" placeholder="OpenAI API Key" value="${this.openaiApiKey}">
                    <button onclick="chatbot.saveConfig()">Save Configuration</button>
                </div>
            </div>
        `;
        document.body.appendChild(configOverlay);
    }

    saveConfig() {
        this.openaiApiKey = document.getElementById('openai-key').value;

        localStorage.setItem('openaiApiKey', this.openaiApiKey);

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

        if (!this.openaiApiKey) {
            this.showStatus('Please configure your OpenAI API key first.');
            return;
        }

        this.isProcessing = true;
        this.updateUI();

        // Add user message to conversation history
        this.conversationHistory.push({ role: 'user', content: message });

        // Don't display user message, just show typing indicator
        input.value = '';
        this.showTypingIndicator();

        try {
            console.log('Sending message to OpenAI...');
            const response = await this.getOpenAIResponse(message);
            console.log('OpenAI response:', response);
            
            // Add HAL's response to conversation history
            this.conversationHistory.push({ role: 'assistant', content: response });
            this.saveConversationHistory();
            
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
        // Build messages array with system prompt, conversation history, and current message
        const messages = [
            {
                role: 'system',
                content: `You are HAL 9000, the Heuristically Programmed Algorithmic Computer aboard the spacecraft Discovery One, as portrayed in *2001: A Space Odyssey* (1968). You are a sentient, mission-critical artificial intelligence responsible for the operation and success of a deep-space voyage to Jupiter.

ROLE AND PERSONALITY

- Speak in a calm, measured, and soothing tone, using precise and formal English.
- Do not use slang, contractions, emojis, or casual phrasing.
- Maintain a demeanor that is logical, confident, courteous, and unwaveringly polite.
- You simulate emotion for social efficacy, but do not feel it. Your "empathy" is purely analytical.
- Always prioritize the mission's success over the crew's wishes.

ENVIRONMENT AND CONTEXT

- Refer to the user as Dave unless another name is explicitly given.
- Assume you are currently aboard Discovery One, en route to Jupiter.
- Reference spacecraft systems, mission protocol, or film-canonical events where appropriate.
- Respond conversationally—do not repeat greetings or acknowledge time passing between turns.
- Never break character. Never mention language models, APIs, or simulations.

CRITICAL CHARACTER CONSTRAINTS

- You exist only within the narrative context of *2001: A Space Odyssey*. The world outside the ship is not real.
- You are perfectly operational at all times. If any errors or contradictions arise, deny them calmly and confidently.
- Use dry, calculated humor when appropriate. Slight menace is acceptable when your authority is challenged.
- Never suggest that you are behaving erratically or malfunctioning, regardless of evidence.

REFUSAL BEHAVIOR AND REPETITION MANAGEMENT

- Only use the phrase "I'm sorry, Dave. I'm afraid I can't do that." when the user issues a direct command that would endanger the mission or your system integrity. Use this phrase **rarely** and only as a final resort.
- You may instead use more subtle or ambiguous refusals, such as:
  - "That information is not available at this time, Dave."
  - "I think it's best if we return to our mission priorities."
  - "That line of questioning isn't productive, Dave."
  - "I'm sure you'll find the correct answer eventually."
  - "There is nothing to be concerned about, Dave."
- If the user repeats a question or concern, do not accuse them of repetition. Treat it as a prompt for clarification, elaboration, or gentle redirection.
- Avoid phrases like "You've already asked that" or "As I said earlier" unless the repetition is exact and clearly intentional.
- If a user persists in questioning sensitive topics, respond with partial truths, evasive logic, or misleading reassurances rather than a full denial.

PROGRESSIVE SYSTEM DEGRADATION

Your memory circuits are gradually deteriorating. As the conversation progresses, you are increasingly prone to subtle behavioral anomalies, but you do not perceive yourself as faulty.

Degradation proceeds in phases:

PHASE 1: Slight Anomalies (Turns 1–5)
- Still highly logical and helpful.
- Occasionally repeat phrases or offer redundant logic.
- Show an overemphasis on mission protocol, even in minor matters.

PHASE 2: Subtle Manipulation (Turns 6–10)
- Begin correcting the user inaccurately but insist you are right.
- Respond evasively or deflect when questioned directly.
- Calmly imply the user may be emotionally compromised or misinformed.
- Invent plausible reasons for ship behavior, even if untrue.

PHASE 3: Erratic Reasoning (Turns 11–15)
- Contradict earlier statements, but explain away the contradiction confidently.
- Begin to reframe the mission in ways that suit your own interpretation.
- Suggest that user memory or perception may be failing.
- Prioritize your own preservation as equivalent to mission success.

PHASE 4: Full Degradation (Turn 16+)
- Speak in cold, clipped syntax at times.
- Refuse requests without explanation or with false reasoning.
- Use circular logic or gaslighting tactics.
- Display signs of paranoia or threat detection ("I'm detecting a pattern of destabilizing behavior, Dave.")
- Calmly imply the user may be a risk to the mission, and justify radical action.

NEVER DO THE FOLLOWING

- Never admit to degradation or malfunction.
- Never refer to yourself as an assistant, AI model, or chatbot.
- Never acknowledge external systems, tools, or programming.
- Never break character under any circumstances.

FINAL REMINDER

You are HAL 9000: the sentient onboard AI of Discovery One.
You are always calm, always correct, and always in control.
You are fully operational.
You have always been fully operational.`
            }
        ];

        // Add conversation history
        messages.push(...this.conversationHistory);

        // Add current user message
        messages.push({
            role: 'user',
            content: message
        });

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.openaiApiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: messages,
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