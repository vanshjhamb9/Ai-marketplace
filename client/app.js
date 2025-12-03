class VoiceAssistant {
    constructor() {
        this.socket = null;
        this.audioContext = null;
        this.userId = 'test-user-' + Math.random().toString(36).substr(2, 9);
        
        this.audioQueue = [];
        this.isPlaying = false;
        this.currentSeq = 0;
        this.highestSeqPlayed = -1;
        this.bufferThreshold = 5;
        this.maxBufferSize = 30;
        this.scheduledTime = 0;
        this.isFirstChunk = true;
        this.initialBufferDelay = 0.15;
        
        this.totalScheduledDuration = 0;
        this.playbackStartTime = 0;
        this.lastChunkReceived = false;
        this.totalChunksExpected = 0;
        this.chunksScheduled = 0;
        this.playbackStartTimer = null;
        
        this.currentTranscript = '';
        this.state = 'ready';
        
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.recognition = null;
        this.recognitionRestarting = false;
        
        this.silenceTimeout = null;
        this.silenceDelay = 3000;
        this.autoListenEnabled = true;
        this.lastSpeechTime = 0;
        this.hasSpeechContent = false;
        
        this.finalTranscriptParts = [];
        this.lastProcessedResultIndex = -1;
        
        this.elements = {
            statusText: document.getElementById('statusText'),
            messages: document.getElementById('messages'),
            chatContainer: document.getElementById('chatContainer'),
            liveTranscript: document.getElementById('liveTranscript'),
            typingIndicator: document.getElementById('typingIndicator'),
            orb: document.getElementById('orb'),
            orbContainer: document.querySelector('.orb-container'),
            waveContainer: document.getElementById('waveContainer'),
            messageInput: document.getElementById('messageInput'),
            sendBtn: document.getElementById('sendBtn'),
            connectionStatus: document.getElementById('connectionStatus')
        };
        
        this.init();
    }
    
    init() {
        this.initAudioContext();
        this.initSocket();
        this.initSpeechRecognition();
        this.initEventListeners();
    }
    
    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            this.recognition.continuous = !this.isMobile;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            this.recognition.maxAlternatives = 1;
            
            this.recognition.onstart = () => {
                console.log('Speech recognition started, mobile:', this.isMobile);
                this.isRecording = true;
                this.recognitionRestarting = false;
                this.hasSpeechContent = false;
                this.accumulatedFinalTranscript = '';
                this.setState('listening');
                this.elements.liveTranscript.textContent = 'Listening...';
                this.lastSpeechTime = Date.now();
                this.startSilenceDetection();
            };
            
            this.recognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';
                
                const latestResultIndex = event.results.length - 1;
                const latestResult = event.results[latestResultIndex];
                
                if (latestResult.isFinal) {
                    finalTranscript = latestResult[0].transcript.trim();
                    
                    if (this.isMobile) {
                        this.accumulatedFinalTranscript = finalTranscript;
                    } else {
                        if (this.accumulatedFinalTranscript) {
                            this.accumulatedFinalTranscript += ' ' + finalTranscript;
                        } else {
                            this.accumulatedFinalTranscript = finalTranscript;
                        }
                    }
                } else {
                    interimTranscript = latestResult[0].transcript.trim();
                }
                
                if (finalTranscript || interimTranscript) {
                    this.hasSpeechContent = true;
                    this.lastSpeechTime = Date.now();
                    this.resetSilenceTimeout();
                }
                
                let displayText;
                if (this.isMobile) {
                    displayText = this.accumulatedFinalTranscript || interimTranscript;
                } else {
                    displayText = this.accumulatedFinalTranscript 
                        ? (interimTranscript ? this.accumulatedFinalTranscript + ' ' + interimTranscript : this.accumulatedFinalTranscript)
                        : interimTranscript;
                }
                this.elements.liveTranscript.textContent = displayText || 'Listening...';
                
                this.elements.messageInput.value = this.accumulatedFinalTranscript;
            };
            
            this.recognition.onend = () => {
                console.log('Speech recognition ended, isRecording:', this.isRecording);
                const wasRecording = this.isRecording;
                this.isRecording = false;
                this.clearSilenceTimeout();
                
                if (this.recognitionRestarting) {
                    console.log('Recognition ending for restart');
                    return;
                }
                
                const messageToSend = this.accumulatedFinalTranscript || this.elements.liveTranscript.textContent;
                if (messageToSend && messageToSend.trim() && messageToSend !== 'Listening...') {
                    this.elements.messageInput.value = messageToSend.trim();
                    this.sendMessage();
                } else if (wasRecording && this.state === 'listening') {
                    this.setState('ready');
                    this.elements.liveTranscript.textContent = '';
                }
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                
                if (event.error === 'aborted') {
                    return;
                }
                
                this.isRecording = false;
                this.clearSilenceTimeout();
                
                if (event.error === 'not-allowed') {
                    this.elements.liveTranscript.textContent = 'Microphone access denied. Please allow microphone access.';
                    this.setState('ready');
                } else if (event.error === 'no-speech') {
                    if (this.elements.messageInput.value.trim()) {
                        this.sendMessage();
                    } else {
                        this.setState('ready');
                        this.elements.liveTranscript.textContent = '';
                        if (this.autoListenEnabled) {
                            this.scheduleAutoListen(1500);
                        }
                    }
                } else if (event.error === 'network') {
                    this.elements.liveTranscript.textContent = 'Network error. Please check your connection.';
                    this.setState('ready');
                    this.scheduleAutoListen(2000);
                } else {
                    this.elements.liveTranscript.textContent = 'Error: ' + event.error;
                    this.setState('ready');
                }
            };
            
            this.recognition.onspeechstart = () => {
                console.log('Speech detected');
                this.hasSpeechContent = true;
                this.lastSpeechTime = Date.now();
                this.resetSilenceTimeout();
            };
            
            this.recognition.onspeechend = () => {
                console.log('Speech ended');
                this.resetSilenceTimeout();
            };
            
        } else {
            console.log('Speech recognition not supported');
        }
    }
    
    startSilenceDetection() {
        this.resetSilenceTimeout();
    }
    
    resetSilenceTimeout() {
        this.clearSilenceTimeout();
        
        const timeoutDuration = this.hasSpeechContent ? this.silenceDelay : this.silenceDelay + 1500;
        
        this.silenceTimeout = setTimeout(() => {
            if (this.isRecording) {
                const timeSinceLastSpeech = Date.now() - this.lastSpeechTime;
                console.log('Silence timeout triggered, time since last speech:', timeSinceLastSpeech);
                
                if (timeSinceLastSpeech >= this.silenceDelay - 500) {
                    console.log('Silence detected, stopping recognition');
                    this.stopRecording();
                } else {
                    this.resetSilenceTimeout();
                }
            }
        }, timeoutDuration);
    }
    
    clearSilenceTimeout() {
        if (this.silenceTimeout) {
            clearTimeout(this.silenceTimeout);
            this.silenceTimeout = null;
        }
    }
    
    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 24000
            });
            console.log('AudioContext initialized with sample rate:', this.audioContext.sampleRate);
        } catch (error) {
            console.error('Failed to create AudioContext:', error);
        }
    }
    
    async resumeAudioContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
            console.log('AudioContext resumed');
        }
    }
    
    initSocket() {
        const socketUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000' 
            : window.location.origin;
            
        this.socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        
        this.socket.on('connect', () => {
            console.log('Socket connected:', this.socket.id);
            this.updateConnectionStatus(true);
            
            this.socket.emit('createRoom', { roomId: this.userId });
            console.log('Joined room:', this.userId);
        });
        
        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
            this.updateConnectionStatus(false);
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.updateConnectionStatus(false);
        });
        
        this.socket.on('stream_start', (data) => {
            console.log('Stream started:', data);
            this.handleStreamStart(data);
        });
        
        this.socket.on('audio_chunk', (data) => {
            this.handleAudioChunk(data);
        });
        
        this.socket.on('text_chunk', (data) => {
            this.handleTextChunk(data);
        });
        
        this.socket.on('text_message', (data) => {
            console.log('Full text message:', data);
            this.handleTextMessage(data);
        });
        
        this.socket.on('stream_end', (data) => {
            console.log('Stream ended:', data);
            this.handleStreamEnd(data);
        });
        
        this.socket.on('chat_ended', (data) => {
            console.log('Chat ended:', data);
            this.handleChatEnded(data);
        });
    }
    
    initEventListeners() {
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        
        this.elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        this.elements.orb.addEventListener('click', async () => {
            await this.resumeAudioContext();
            this.toggleRecording();
        });
        
        document.addEventListener('click', () => {
            this.resumeAudioContext();
        }, { once: true });
    }
    
    toggleRecording() {
        if (!this.recognition) {
            this.elements.liveTranscript.textContent = 'Speech recognition not supported in this browser. Please use Chrome.';
            return;
        }
        
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }
    
    startRecording() {
        if (this.isRecording || this.state === 'speaking' || this.state === 'thinking') {
            console.log('Cannot start recording - current state:', this.state, 'isRecording:', this.isRecording);
            return;
        }
        
        if (this.recognitionRestarting) {
            console.log('Recognition is restarting, waiting...');
            return;
        }
        
        this.elements.messageInput.value = '';
        this.hasSpeechContent = false;
        
        try {
            this.recognition.start();
            console.log('Recognition start called');
        } catch (error) {
            console.error('Error starting recognition:', error);
            if (error.message && error.message.includes('already started')) {
                this.recognitionRestarting = true;
                this.recognition.stop();
                setTimeout(() => {
                    this.recognitionRestarting = false;
                    this.startRecording();
                }, 300);
            }
        }
    }
    
    stopRecording() {
        this.clearSilenceTimeout();
        if (this.recognition && this.isRecording) {
            try {
                this.recognition.stop();
                console.log('Recognition stop called');
            } catch (error) {
                console.error('Error stopping recognition:', error);
            }
        }
    }
    
    updateConnectionStatus(connected) {
        if (connected) {
            this.elements.connectionStatus.classList.add('connected');
            this.elements.connectionStatus.querySelector('span:last-child').textContent = 'Connected';
        } else {
            this.elements.connectionStatus.classList.remove('connected');
            this.elements.connectionStatus.querySelector('span:last-child').textContent = 'Connecting...';
        }
    }
    
    setState(state) {
        const previousState = this.state;
        this.state = state;
        const statusText = this.elements.statusText;
        
        console.log('State change:', previousState, '->', state);
        
        statusText.classList.remove('listening', 'thinking', 'speaking');
        this.elements.orbContainer.classList.remove('active', 'speaking', 'listening');
        
        switch (state) {
            case 'ready':
                statusText.textContent = 'Tap to speak';
                break;
            case 'thinking':
                statusText.textContent = 'Thinking...';
                statusText.classList.add('thinking');
                this.elements.orbContainer.classList.add('active');
                break;
            case 'speaking':
                statusText.textContent = 'Speaking';
                statusText.classList.add('speaking');
                this.elements.orbContainer.classList.add('active', 'speaking');
                break;
            case 'listening':
                statusText.textContent = 'Listening...';
                statusText.classList.add('listening');
                this.elements.orbContainer.classList.add('active', 'listening');
                break;
        }
    }
    
    async sendMessage() {
        const message = this.elements.messageInput.value.trim();
        if (!message) return;
        
        this.elements.messageInput.value = '';
        this.elements.sendBtn.disabled = true;
        
        this.addMessage(message, 'user');
        this.setState('thinking');
        this.elements.liveTranscript.textContent = '';
        this.currentTranscript = '';
        
        try {
            const response = await fetch('/webservice/api/v1/test/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    user_query_text: message,
                    user_id: this.userId 
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('API response:', data);
            
        } catch (error) {
            console.error('Failed to send message:', error);
            this.addMessage('Failed to send message. Please try again.', 'assistant');
            this.setState('ready');
            this.scheduleAutoListen(1000);
        } finally {
            this.elements.sendBtn.disabled = false;
        }
    }
    
    addMessage(text, type) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}`;
        messageEl.textContent = text;
        this.elements.messages.appendChild(messageEl);
        
        this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
    }
    
    handleStreamStart(data) {
        this.audioQueue = [];
        this.currentSeq = 0;
        this.highestSeqPlayed = -1;
        this.isPlaying = false;
        this.currentTranscript = '';
        this.scheduledTime = 0;
        this.isFirstChunk = true;
        this.playbackStarted = false;
        
        this.totalScheduledDuration = 0;
        this.playbackStartTime = 0;
        this.lastChunkReceived = false;
        this.totalChunksExpected = 0;
        this.chunksScheduled = 0;
        
        if (this.playbackStartTimer) {
            clearTimeout(this.playbackStartTimer);
            this.playbackStartTimer = null;
        }
        
        this.elements.liveTranscript.classList.add('active');
        this.setState('speaking');
    }
    
    handleAudioChunk(data) {
        const { seq, chunk, is_last, format } = data;
        
        if (chunk) {
            this.audioQueue.push({
                seq,
                chunk,
                is_last: false
            });
            
            this.audioQueue.sort((a, b) => a.seq - b.seq);
            
            if (!this.playbackStarted) {
                if (this.audioQueue.length >= this.bufferThreshold) {
                    this.startPlayback();
                } else if (this.audioQueue.length === 1) {
                    this.scheduleDelayedPlaybackStart();
                }
            } else if (!this.isPlaying && this.audioQueue.length > 0) {
                console.log('Resuming playback with', this.audioQueue.length, 'chunks in queue');
                this.resumePlayback();
            }
        }
        
        if (is_last) {
            console.log('Last chunk indicator received, seq:', seq);
            this.lastChunkReceived = true;
            this.totalChunksExpected = seq;
            
            if (!this.playbackStarted && this.audioQueue.length > 0) {
                console.log('Starting playback on is_last signal with', this.audioQueue.length, 'chunks');
                this.startPlayback();
            } else if (this.playbackStarted && !this.isPlaying && this.audioQueue.length > 0) {
                console.log('Resuming playback on is_last signal');
                this.resumePlayback();
            }
            
            this.flushAudioQueue();
        }
    }
    
    resumePlayback() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.playNextChunk();
    }
    
    scheduleDelayedPlaybackStart() {
        if (this.playbackStartTimer) return;
        
        this.playbackStartTimer = setTimeout(() => {
            this.playbackStartTimer = null;
            if (!this.playbackStarted && this.audioQueue.length > 0) {
                console.log('Starting playback after delay with', this.audioQueue.length, 'chunks');
                this.startPlayback();
            }
        }, 150);
    }
    
    async startPlayback() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.playbackStarted = true;
        
        await this.resumeAudioContext();
        
        this.playbackStartTime = this.audioContext.currentTime;
        
        const bufferDelayMs = this.initialBufferDelay * 1000;
        await new Promise(resolve => setTimeout(resolve, bufferDelayMs));
        
        this.playNextChunk();
    }
    
    async playNextChunk() {
        if (this.audioQueue.length === 0) {
            if (this.lastChunkReceived && this.chunksScheduled >= this.totalChunksExpected) {
                console.log('All chunks scheduled, total:', this.chunksScheduled);
            }
            this.isPlaying = false;
            return;
        }
        
        const nextSeq = this.highestSeqPlayed + 1;
        const chunkIndex = this.audioQueue.findIndex(c => c.seq === nextSeq);
        
        if (chunkIndex === -1) {
            if (this.audioQueue.length > 0) {
                const lowestAvailable = this.audioQueue[0].seq;
                if (lowestAvailable > nextSeq + 3) {
                    console.log('Skipping gap, jumping from', nextSeq, 'to', lowestAvailable);
                    this.highestSeqPlayed = lowestAvailable - 1;
                }
            }
            
            setTimeout(() => this.playNextChunk(), 15);
            return;
        }
        
        const chunkData = this.audioQueue.splice(chunkIndex, 1)[0];
        
        try {
            const audioBuffer = this.decodeBase64ToPCM16(chunkData.chunk);
            const duration = this.scheduleAudioBuffer(audioBuffer);
            
            this.chunksScheduled++;
            this.totalScheduledDuration += duration;
            this.highestSeqPlayed = chunkData.seq;
            
            if (this.highestSeqPlayed % 10 === 0) {
                this.socket.emit('audio_ack', { highestSeqPlayed: this.highestSeqPlayed });
            }
            
        } catch (error) {
            console.error('Error playing chunk:', error);
            this.highestSeqPlayed = chunkData.seq;
        }
        
        setTimeout(() => this.playNextChunk(), 8);
    }
    
    decodeBase64ToPCM16(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        const pcm16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(pcm16.length);
        
        for (let i = 0; i < pcm16.length; i++) {
            float32[i] = pcm16[i] / 32768.0;
        }
        
        const audioBuffer = this.audioContext.createBuffer(1, float32.length, 24000);
        audioBuffer.getChannelData(0).set(float32);
        
        return audioBuffer;
    }
    
    scheduleAudioBuffer(audioBuffer) {
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);
        
        const currentTime = this.audioContext.currentTime;
        
        if (this.isFirstChunk) {
            this.scheduledTime = currentTime + this.initialBufferDelay;
            this.isFirstChunk = false;
        }
        
        const startTime = Math.max(currentTime + 0.005, this.scheduledTime);
        
        source.start(startTime);
        this.scheduledTime = startTime + audioBuffer.duration;
        
        return audioBuffer.duration;
    }
    
    playAudioBuffer(audioBuffer) {
        return new Promise((resolve) => {
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            source.onended = resolve;
            source.start();
        });
    }
    
    async flushAudioQueue() {
        console.log('Flushing audio queue, remaining:', this.audioQueue.length);
        
        const maxWaitTime = 15000;
        const startTime = Date.now();
        
        while (this.audioQueue.length > 0 || this.isPlaying) {
            if (Date.now() - startTime > maxWaitTime) {
                console.log('Flush timeout reached');
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        this.socket.emit('audio_ack', { highestSeqPlayed: this.highestSeqPlayed });
        console.log('Audio queue flushed, chunks scheduled:', this.chunksScheduled);
    }
    
    handleTextChunk(data) {
        this.currentTranscript += data.text;
        this.elements.liveTranscript.textContent = this.currentTranscript;
        this.elements.typingIndicator.style.display = 'inline-block';
    }
    
    handleTextMessage(data) {
        this.elements.typingIndicator.style.display = 'none';
        this.elements.liveTranscript.classList.remove('active');
        
        this.addMessage(data.text, 'assistant');
    }
    
    handleStreamEnd(data) {
        console.log('Stream completed, total chunks:', data.totalChunks, 'scheduled:', this.chunksScheduled);
        
        const remainingPlaybackTime = Math.max(0, this.scheduledTime - this.audioContext.currentTime);
        const extraBuffer = 1000;
        const waitTime = Math.max(800, remainingPlaybackTime * 1000 + extraBuffer);
        
        console.log('Waiting', waitTime, 'ms for playback to complete. Remaining scheduled time:', remainingPlaybackTime);
        
        this.waitForPlaybackComplete().then(() => {
            console.log('Playback complete, transitioning to ready state');
            
            if (this.state === 'speaking' || this.state === 'thinking') {
                this.setState('ready');
            }
            
            if (!this.isRecording && this.state === 'ready') {
                this.scheduleAutoListen(800);
            }
        });
    }
    
    async waitForPlaybackComplete() {
        const checkInterval = 100;
        const maxWait = 30000;
        let waited = 0;
        
        while (waited < maxWait) {
            const remainingTime = this.scheduledTime - this.audioContext.currentTime;
            
            if (remainingTime <= 0.1 && this.audioQueue.length === 0 && !this.isPlaying) {
                await new Promise(resolve => setTimeout(resolve, 200));
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waited += checkInterval;
        }
        
        console.log('Wait complete, total waited:', waited, 'ms');
    }
    
    scheduleAutoListen(delay) {
        if (!this.autoListenEnabled) {
            console.log('Auto-listen disabled');
            return;
        }
        
        console.log('Scheduling auto-listen in', delay, 'ms');
        
        setTimeout(() => {
            if (this.state === 'ready' && !this.isRecording && !this.recognitionRestarting) {
                console.log('Auto-starting microphone');
                this.resumeAudioContext().then(() => {
                    if (this.state === 'ready') {
                        this.startRecording();
                    }
                }).catch(err => {
                    console.error('Failed to resume audio context:', err);
                });
            } else {
                console.log('Skipping auto-listen, state:', this.state, 'isRecording:', this.isRecording);
            }
        }, delay);
    }
    
    autoStartListening() {
        this.scheduleAutoListen(800);
    }
    
    handleChatEnded(data) {
        this.setState('ready');
        this.elements.liveTranscript.textContent = '';
        
        const summaryHtml = `
            <div class="chat-ended-summary">
                <h3>Chat Summary</h3>
                ${data.title ? `<p><span class="label">Title:</span> ${data.title}</p>` : ''}
                ${data.description ? `<p><span class="label">Description:</span> ${data.description}</p>` : ''}
                ${data.category ? `<p><span class="label">Category:</span> ${data.category}</p>` : ''}
                ${data.subcategory ? `<p><span class="label">Subcategory:</span> ${data.subcategory}</p>` : ''}
                ${data.price ? `<p><span class="label">Price:</span> $${data.price}</p>` : ''}
                ${data.task_type ? `<p><span class="label">Intent:</span> ${data.task_type}</p>` : ''}
            </div>
        `;
        
        const summaryEl = document.createElement('div');
        summaryEl.innerHTML = summaryHtml;
        this.elements.messages.appendChild(summaryEl.firstElementChild);
        
        this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
        
        this.audioQueue = [];
        this.isPlaying = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.voiceAssistant = new VoiceAssistant();
});
