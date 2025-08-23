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
        this.backgroundAudio = null;
        this.bgStarted = false;
        this.isSpeaking = false;
        this.alarmAudio = null;
        this.alarmTimerId = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadApiKeys();
        this.loadConversationHistory();
        this.initializeBackgroundAudio();
        this.initializeAlarmAudio();
        // Pre-create SpeechRecognition so first click starts instantly
        this.initializeSpeechRecognition();
        // Restore remembered mic grant state (best-effort; browser still governs real permission)
        try {
            if (localStorage.getItem('halMicGranted') === '1') {
                this.hasMicPermission = true;
            }
        } catch (_) {}
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
        if (micBtn) {
            micBtn.addEventListener('click', () => {
                if (this.isProcessing) return;

                // Unlock and start ambient audio immediately; do not block voice start
                this.ensureAudioUnlocked();
                this.startBackgroundAudio();
                this.startAlarmLoop();

                // Start listening right away to avoid UX delay
                this.toggleVoiceInput();

                // Non-blocking warm-up call: ensures browsers consider mic permission used, without prompting again
                if (!this.hasMicPermission && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    this.requestMicPermission().catch((err) => {
                        console.error('Microphone permission denied:', err);
                        this.showStatus('Microphone access is required. Please allow mic permission.');
                    });
                }
            });
        }
        // Removed settings button
    }

    async requestMicPermission() {
        if (this.hasMicPermission) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return; // Fallback to SpeechRecognition permission flow
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.micStream = stream;
        this.hasMicPermission = true;
        // Keep the stream, but disable tracks so the mic isn't actively used
        for (const track of stream.getTracks()) {
            try { track.enabled = false; } catch (_) {}
        }
        try { localStorage.setItem('halMicGranted', '1'); } catch (_) {}
    }

    loadApiKeys() {
        // API key is now handled securely by the backend
        // No need to load from localStorage
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
        // No longer needed - API key is handled by backend
    }

    saveConfig() {
        // No longer needed - API key is handled by backend
    }

    async sendMessage(message) {
        const text = (message ?? '').trim();
        if (!text) return;

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
        // Use secure backend instead of direct API calls
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                conversationHistory: this.conversationHistory
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Backend error: ${response.status}`);
        }

        const data = await response.json();
        
        // Update conversation history with the response
        this.conversationHistory = data.conversationHistory;
        
        return data.response;
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
            this.isSpeaking = true;
        }).catch(() => {
            this.showStatus('Auto-play blocked. Tap Play to hear HAL.');
            this.showPlayButton();
        });
        audio.onended = () => {
            this.showStatus('');
            const btn = document.getElementById('play-audio-btn');
            if (btn) btn.remove();
            this.isSpeaking = false;
        };
        audio.onerror = () => {
            this.showStatus('Audio playback failed.');
            const btn = document.getElementById('play-audio-btn');
            if (btn) btn.remove();
            this.isSpeaking = false;
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

    initializeBackgroundAudio() {
        const element = document.getElementById('bg-audio');
        if (!element) return;
        this.backgroundAudio = element;
        this.backgroundAudio.loop = true;
        this.backgroundAudio.volume = 0.18;
        this.backgroundAudio.onerror = () => {
            console.warn('Background audio failed to load. Place drone.wav in the app folder.');
        };
        // Attempt to start immediately; if blocked by autoplay policy, it will start on first gesture
        this.backgroundAudio.play().then(() => {
            this.bgStarted = true;
        }).catch(() => {
            // Will retry on user gesture via startBackgroundAudio()
        });
    }

    startBackgroundAudio() {
        if (!this.backgroundAudio || this.bgStarted) return;
        this.backgroundAudio.play().then(() => {
            this.bgStarted = true;
        }).catch(() => {
            // Will start after next user gesture
        });
    }

    setBackgroundDucking(shouldDuck) {
        if (!this.backgroundAudio) return;
        this.backgroundAudio.volume = shouldDuck ? 0.06 : 0.18;
    }

    initializeAlarmAudio() {
        const element = document.getElementById('alarm-audio');
        if (!element) return;
        this.alarmAudio = element;
        this.alarmAudio.volume = 0.6; // tune as needed
        this.alarmAudio.onerror = () => {
            console.warn('Alarm audio failed to load. Place alarm.wav in the app folder.');
        };
    }

    startAlarmLoop() {
        if (!this.alarmAudio || this.alarmTimerId) return;
        const scheduleNext = () => {
            const seconds = 30 + Math.random() * 10; // 30–40 seconds
            this.alarmTimerId = setTimeout(async () => {
                try {
                    // Create a fresh instance to allow overlap and ensure play() returns a promise
                    const src = this.alarmAudio.getAttribute('src');
                    const alarm = new Audio(src);
                    alarm.volume = this.alarmAudio.volume;
                    await alarm.play();
                } catch (_) {
                    // Ignore autoplay errors; will retry next tick after user gesture
                } finally {
                    scheduleNext();
                }
            }, seconds * 1000);
        };
        scheduleNext();
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