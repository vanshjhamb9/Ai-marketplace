class VoiceAssistant {
    constructor() {
        this.socket = null;
        this.audioContext = null;
        this.userId = 'test-user-' + Math.random().toString(36).substr(2, 9);
        this.authToken = 'mock-auth-token-for-testing';
        
        this.audioQueue = [];
        this.isPlaying = false;
        this.currentSeq = 0;
        this.highestSeqPlayed = -1;
        this.bufferThreshold = 3;
        this.maxBufferSize = 10;
        
        this.currentTranscript = '';
        this.state = 'ready';
        
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
        this.initEventListeners();
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
            this.elements.messageInput.focus();
        });
        
        document.addEventListener('click', () => {
            this.resumeAudioContext();
        }, { once: true });
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
        this.state = state;
        const statusText = this.elements.statusText;
        
        statusText.classList.remove('listening', 'thinking', 'speaking');
        this.elements.orbContainer.classList.remove('active', 'speaking');
        
        switch (state) {
            case 'ready':
                statusText.textContent = 'Ready';
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
                this.elements.orbContainer.classList.add('active');
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
            const response = await fetch('/webservice/api/v1/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ user_query_text: message })
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
            
            if (this.audioQueue.length >= this.bufferThreshold && !this.isPlaying) {
                this.startPlayback();
            }
        }
        
        if (is_last) {
            this.flushAudioQueue();
        }
    }
    
    async startPlayback() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        
        await this.resumeAudioContext();
        this.playNextChunk();
    }
    
    async playNextChunk() {
        if (this.audioQueue.length === 0) {
            this.isPlaying = false;
            return;
        }
        
        const nextSeq = this.highestSeqPlayed + 1;
        const chunkIndex = this.audioQueue.findIndex(c => c.seq === nextSeq);
        
        if (chunkIndex === -1) {
            if (this.audioQueue.length > 0 && this.audioQueue[0].seq > nextSeq + 5) {
                this.highestSeqPlayed = this.audioQueue[0].seq - 1;
            }
            
            setTimeout(() => this.playNextChunk(), 50);
            return;
        }
        
        const chunkData = this.audioQueue.splice(chunkIndex, 1)[0];
        
        try {
            const audioBuffer = this.decodeBase64ToPCM16(chunkData.chunk);
            await this.playAudioBuffer(audioBuffer);
            
            this.highestSeqPlayed = chunkData.seq;
            
            if (this.highestSeqPlayed % 5 === 0) {
                this.socket.emit('audio_ack', { highestSeqPlayed: this.highestSeqPlayed });
            }
            
        } catch (error) {
            console.error('Error playing chunk:', error);
        }
        
        this.playNextChunk();
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
        while (this.audioQueue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        while (this.isPlaying) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.socket.emit('audio_ack', { highestSeqPlayed: this.highestSeqPlayed });
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
        console.log('Stream completed, total chunks:', data.totalChunks);
        
        setTimeout(() => {
            if (this.state === 'speaking' && !this.isPlaying) {
                this.setState('ready');
            }
        }, 1000);
    }
    
    handleChatEnded(data) {
        this.setState('ready');
        this.elements.liveTranscript.textContent = '';
        
        const summaryHtml = `
            <div class="chat-ended-summary">
                <h3>📋 Chat Summary</h3>
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
