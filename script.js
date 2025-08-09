class Chatbot {
    constructor() {
        this.openaiApiKey = '';
        this.elevenLabsApiKey = 'sk_0ad8934840d686d2a7abab86c98544507d1f90fa00d159e9'; // Hardcoded
        this.voiceId = 'sos6t4F82ZagrStqD8Ra'; // Hardcoded
        this.isProcessing = false;
        this.isRecording = false;
        this.recognition = null;
        this.conversationHistory = [];
        this.pendingAudioElement = null;
        this.audioUnlocked = false;
        this.audioContext = null;
        this.micStream = null;
        this.hasMicPermission = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadApiKeys();
        this.loadConversationHistory();
    }

    toggleVoiceInput() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    startRecording() {
        if (!this.initializeSpeechRecognition()) return;
        try {
            this.recognition.start();
        } catch (_) {
            // Some browsers throw if already started; ensure state sync
        }
    }

    stopRecording() {
        if (this.recognition) {
            this.recognition.stop();
        }
        this.isRecording = false;
        this.updateMicButton();
        // Keep any status message set by caller
    }

    initializeSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.showStatus('Speech recognition not supported in this browser.');
            return false;
        }
        if (this.recognition) return true;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            this.isRecording = true;
            this.updateMicButton();
            this.showStatus('Listening... Speak now.');
        };
        recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript;
            this.showStatus('Processing voice input...');
            await this.sendMessage(transcript);
        };
        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.showStatus(`Voice input error: ${event.error}`);
            this.stopRecording();
        };
        recognition.onend = () => {
            this.stopRecording();
        };

        this.recognition = recognition;
        return true;
    }

    updateMicButton() {
        const micBtn = document.getElementById('mic-btn');
        if (!micBtn) return;
        if (this.isRecording) {
            micBtn.classList.add('recording');
        } else {
            micBtn.classList.remove('recording');
        }
        micBtn.disabled = this.isProcessing; // disable during processing
    }

    setupEventListeners() {
        const micBtn = document.getElementById('mic-btn');
        const settingsBtn = document.getElementById('settings-btn');
        if (micBtn) {
            micBtn.addEventListener('click', () => {
                if (!this.isProcessing) {
                    this.ensureAudioUnlocked();
                    this.requestMicPermission().then(() => {
                        this.toggleVoiceInput();
                    }).catch((err) => {
                        console.error('Microphone permission denied:', err);
                        this.showStatus('Microphone access is required. Please allow mic permission.');
                    });
                }
            });
        }
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showConfigPrompt());
        }
    }

    async requestMicPermission() {
        if (this.hasMicPermission) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return; // Fallback to SpeechRecognition permission flow
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.micStream = stream;
        this.hasMicPermission = true;
        // Stop tracks immediately; permission remains granted for the session
        for (const track of stream.getTracks()) {
            try { track.stop(); } catch (_) {}
        }
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
        // Avoid duplicating the overlay
        if (document.querySelector('.config-overlay')) return;

        const configOverlay = document.createElement('div');
        configOverlay.className = 'config-overlay';
        configOverlay.innerHTML = `
            <div class="config-content">
                <h3>API Configuration Required</h3>
                <p>Please enter your OpenAI API key to get started:</p>
                <div class="config-inputs">
                    <input type="password" id="openai-key" placeholder="OpenAI API Key" value="${this.openaiApiKey || ''}">
                    <button id="save-config-btn">Save Configuration</button>
                </div>
            </div>
        `;
        document.body.appendChild(configOverlay);

        const inputEl = document.getElementById('openai-key');
        const saveBtn = document.getElementById('save-config-btn');
        if (inputEl) {
            inputEl.focus();
            inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.saveConfig();
                }
            });
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveConfig());
        }
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

    async sendMessage(message) {
        const text = (message ?? '').trim();
        if (!text) return;

        if (!this.openaiApiKey) {
            this.showConfigPrompt();
            this.showStatus('Please configure your OpenAI API key first.');
            return;
        }

        this.isProcessing = true;
        this.updateMicButton();

        // Add user message to conversation history
        this.conversationHistory.push({ role: 'user', content: text });

        try {
            this.showStatus('Contacting HAL...');
            const response = await this.getOpenAIResponse(text);
            
            // Add HAL's response to conversation history
            this.conversationHistory.push({ role: 'assistant', content: response });
            this.saveConversationHistory();
            
            // Play audio only
            this.showStatus('Speaking...');
            await this.convertToSpeechAndPlay(response);
            this.showStatus('');
        } catch (error) {
            console.error('Error in sendMessage:', error);
            this.showStatus(`Error: ${error.message}`);
        }

        this.isProcessing = false;
        this.updateMicButton();
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
                model: 'gpt-4o-mini',
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
                    'xi-api-key': this.elevenLabsApiKey,
                    'accept': 'audio/mpeg'
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
                        'xi-api-key': this.elevenLabsApiKey,
                        'accept': 'audio/mpeg'
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
        this.pendingAudioElement = audio;
        audio.play().then(() => {
            this.pendingAudioElement = null;
        }).catch(() => {
            this.showStatus('Auto-play blocked. Tap Play to hear HAL.');
            this.showPlayButton();
        });
        audio.onended = () => {
            this.showStatus('');
            const btn = document.getElementById('play-audio-btn');
            if (btn) btn.remove();
        };
        audio.onerror = () => {
            this.showStatus('Audio playback failed.');
            const btn = document.getElementById('play-audio-btn');
            if (btn) btn.remove();
        };
    }

    ensureAudioUnlocked() {
        if (this.audioUnlocked) return;
        try {
            const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
            if (AudioContextCtor) {
                if (!this.audioContext) {
                    this.audioContext = new AudioContextCtor();
                }
                this.audioContext.resume().catch(() => {});
            }
            const silent = new Audio();
            silent.muted = true;
            // Attempt a short play to satisfy autoplay policies
            silent.play().then(() => {
                silent.pause();
                this.audioUnlocked = true;
            }).catch(() => {
                // Even if this fails, user gesture occurred; continue
                this.audioUnlocked = true;
            });
        } catch (_) {
            this.audioUnlocked = true;
        }
    }

    showPlayButton() {
        let btn = document.getElementById('play-audio-btn');
        if (btn) return;
        btn = document.createElement('button');
        btn.id = 'play-audio-btn';
        btn.textContent = 'Play';
        btn.setAttribute('aria-label', 'Play HAL response');
        btn.style.position = 'absolute';
        btn.style.bottom = '110px';
        btn.style.left = '50%';
        btn.style.transform = 'translateX(-50%)';
        btn.style.padding = '12px 18px';
        btn.style.borderRadius = '20px';
        btn.style.border = '1px solid rgba(255,255,255,0.2)';
        btn.style.background = 'rgba(0,0,0,0.6)';
        btn.style.color = '#fff';
        btn.style.zIndex = '101';
        btn.addEventListener('click', () => this.playPendingAudio());
        document.body.appendChild(btn);
    }

    playPendingAudio() {
        if (!this.pendingAudioElement) return;
        this.pendingAudioElement.play().then(() => {
            const btn = document.getElementById('play-audio-btn');
            if (btn) btn.remove();
            this.showStatus('');
            this.pendingAudioElement = null;
        }).catch(() => {
            this.showStatus('Tap Play again to allow audio.');
        });
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
}

// Initialize chatbot when page loads
let chatbot;
document.addEventListener('DOMContentLoaded', () => {
    chatbot = new Chatbot();
});