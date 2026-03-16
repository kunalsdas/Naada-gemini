/**
 * Naada - Audio Processor (v2)
 * Handles microphone capture (PCM 16kHz) and audio playback (PCM 24kHz).
 *
 * Uses AudioWorklet where available, falls back to ScriptProcessor.
 * Playback uses a continuous buffer queue for smooth streaming audio.
 */

class AudioProcessor {
    constructor() {
        this.captureCtx = null;
        this.micStream = null;
        this.isCapturing = false;
        this.isMuted = false;
        this.onAudioData = null; // callback: (ArrayBuffer) => void
        this.onVoiceActivity = null; // callback: (rms: number) => void

        // Playback - use a queue + scheduled playback for smooth streaming
        this.playbackCtx = null;
        this.nextPlayTime = 0;
        this.PLAYBACK_RATE = 24000;
    }

    /**
     * Initialize: request microphone and create audio contexts.
     */
    async init() {
        // Request microphone
        this.micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
        });

        // Capture context at 16kHz
        this.captureCtx = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 16000,
        });

        // Playback context at 24kHz
        this.playbackCtx = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: this.PLAYBACK_RATE,
        });
        this.nextPlayTime = 0;

        console.log("[Audio] Initialized. Capture:", this.captureCtx.sampleRate,
                     "Playback:", this.playbackCtx.sampleRate);
    }

    /**
     * Start capturing microphone audio and calling onAudioData.
     */
    startCapture() {
        if (this.isCapturing || !this.captureCtx || !this.micStream) return;

        const source = this.captureCtx.createMediaStreamSource(this.micStream);
        // Smallest practical buffer = lowest latency for instant interruption
        const processor = this.captureCtx.createScriptProcessor(1024, 1, 1);

        // Voice activity detection threshold — ONLY for visual feedback, NOT for gating.
        // We ALWAYS send audio to Gemini so its server-side VAD receives a
        // continuous stream (including silence). This is critical for:
        //   1. End-of-speech detection (Gemini needs silence frames)
        //   2. Slow speech recognition (pauses between words preserved)
        //   3. Natural prosody & accurate transcription
        const VOICE_ACTIVITY_THRESHOLD = 0.008;

        // Accumulation buffer — batch 4 chunks (~256ms at 16kHz) into
        // a single WebSocket frame for lower overhead and smoother streaming
        let accumBuf = new Int16Array(0);
        const BATCH_FRAMES = 4; // 4 × 1024 = 4096 samples = 256ms
        let frameCount = 0;

        processor.onaudioprocess = (e) => {
            if (this.isMuted || !this.onAudioData) return;

            const float32 = e.inputBuffer.getChannelData(0);

            // Calculate RMS energy for visual feedback only
            let sumSquares = 0;
            for (let i = 0; i < float32.length; i++) {
                sumSquares += float32[i] * float32[i];
            }
            const rms = Math.sqrt(sumSquares / float32.length);

            // Report voice activity for mic button glow
            if (this.onVoiceActivity) this.onVoiceActivity(rms);

            // Convert float32 [-1,1] → int16 PCM
            const pcm16 = new Int16Array(float32.length);
            for (let i = 0; i < float32.length; i++) {
                const s = Math.max(-1, Math.min(1, float32[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            // Accumulate into batch buffer
            const newBuf = new Int16Array(accumBuf.length + pcm16.length);
            newBuf.set(accumBuf, 0);
            newBuf.set(pcm16, accumBuf.length);
            accumBuf = newBuf;
            frameCount++;

            // Send every BATCH_FRAMES or immediately when voice detected
            if (frameCount >= BATCH_FRAMES || rms >= VOICE_ACTIVITY_THRESHOLD) {
                this.onAudioData(accumBuf.buffer);
                accumBuf = new Int16Array(0);
                frameCount = 0;
            }
        };

        source.connect(processor);
        processor.connect(this.captureCtx.destination);
        this.isCapturing = true;
        this._processor = processor;
        this._source = source;
        console.log("[Audio] Capture started");
    }

    stopCapture() {
        if (this._processor) {
            this._processor.disconnect();
            this._processor = null;
        }
        if (this._source) {
            this._source.disconnect();
            this._source = null;
        }
        this.isCapturing = false;
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        return this.isMuted;
    }

    /**
     * Initialize agent voice gain node (low volume for speaking)
     */
    _ensureAgentGain() {
        if (!this._agentGain && this.playbackCtx) {
            this._agentGain = this.playbackCtx.createGain();
            this._agentGain.gain.value = 0.35; // LOW volume for agent speech
            this._agentGain.connect(this.playbackCtx.destination);
        }
    }

    /**
     * Play raw PCM audio from the agent.
     * Uses scheduled playback for gapless streaming.
     *
     * @param {ArrayBuffer} pcmArrayBuffer - Raw PCM 16-bit, 24kHz, mono
     */
    playAudio(pcmArrayBuffer) {
        this.playAgentAudio(pcmArrayBuffer);
    }

    /**
     * Play agent speech at controlled (lower) volume.
     * Music stays high, agent voice is softer.
     */
    playAgentAudio(pcmArrayBuffer) {
        if (!this.playbackCtx || !pcmArrayBuffer || pcmArrayBuffer.byteLength === 0) return;

        // Resume context if suspended (browser autoplay policy)
        if (this.playbackCtx.state === "suspended") {
            this.playbackCtx.resume();
        }

        this._ensureAgentGain();

        // Convert Int16 → Float32
        const int16 = new Int16Array(pcmArrayBuffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
            float32[i] = int16[i] / 32768.0;
        }

        // Create AudioBuffer
        const buffer = this.playbackCtx.createBuffer(1, float32.length, this.PLAYBACK_RATE);
        buffer.getChannelData(0).set(float32);

        // Schedule for gapless playback through low-volume gain node
        const source = this.playbackCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(this._agentGain);

        const now = this.playbackCtx.currentTime;
        const startTime = Math.max(now, this.nextPlayTime);
        source.start(startTime);
        this.nextPlayTime = startTime + buffer.duration;
    }

    /**
     * Stop all playback immediately — kills agent speech so user can interrupt.
     */
    stopPlayback() {
        if (this.playbackCtx) {
            this.playbackCtx.close();
            this.playbackCtx = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.PLAYBACK_RATE,
            });
            this._agentGain = null; // will be recreated on next play
            this.nextPlayTime = 0;
        }
    }

    /**
     * Clean up everything.
     */
    destroy() {
        this.stopCapture();
        if (this.micStream) {
            this.micStream.getTracks().forEach(t => t.stop());
            this.micStream = null;
        }
        if (this.captureCtx) {
            this.captureCtx.close();
            this.captureCtx = null;
        }
        if (this.playbackCtx) {
            this.playbackCtx.close();
            this.playbackCtx = null;
        }
    }
}

window.AudioProcessor = AudioProcessor;
