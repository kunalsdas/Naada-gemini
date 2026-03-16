/**
 * Naada - WebSocket Client (v2)
 * Handles bidirectional communication with the backend.
 *
 * Protocol:
 *   Client → Server:
 *     - Binary frames: PCM audio (16kHz, 16-bit, mono)
 *     - Text frames: JSON {"type": "image"|"text", ...}
 *
 *   Server → Client:
 *     - Binary frames: PCM audio (24kHz, 16-bit, mono) from agent
 *     - Text frames: JSON messages (transcripts, status, control)
 */

class WebSocketClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.userId = null;
        this.sessionId = null;

        // Callbacks
        this.onConnected = null;
        this.onDisconnected = null;
        this.onAudioData = null;           // raw ArrayBuffer of PCM 24kHz
        this.onInputTranscript = null;     // user speech transcript
        this.onOutputTranscript = null;    // agent speech transcript
        this.onAgentText = null;           // text from agent
        this.onTherapyPlay = null;         // therapy sound trigger
        this.onTherapyMix = null;          // AI-mixed layered therapy
        this.onComposeRaga = null;         // Generative raga composition
        this.onMeditationStart = null;     // meditation mode start
        this.onMeditationEnd = null;       // meditation mode end
        this.onTherapyVolume = null;       // volume change
        this.onSpotifyPlay = null;         // Spotify started playing
        this.onSpotifyStatus = null;       // Spotify control action
        this.onSpotifyNowPlaying = null;   // Spotify track info
        this.onWellnessScore = null;       // wellness score update
        this.onMoodAssessed = null;        // mood assessed event
        this.onMoodChanged = null;         // mood changed event
        this.onAffirmation = null;         // affirmation card display
        this.onSessionInsight = null;      // AI session insight
        this.onTurnComplete = null;        // agent done speaking
        this.onInterrupted = null;         // user interrupted
        this.onStatus = null;              // status change
        this.onError = null;
    }

    async connect() {
        try {
            const res = await fetch("/api/session");
            if (!res.ok) throw new Error("Failed to create session");
            const session = await res.json();
            this.userId = session.user_id;
            this.sessionId = session.session_id;

            const proto = location.protocol === "https:" ? "wss:" : "ws:";
            const url = `${proto}//${location.host}/ws/${this.userId}/${this.sessionId}`;
            this.ws = new WebSocket(url);
            this.ws.binaryType = "arraybuffer";

            this.ws.onopen = () => {
                console.log("[WS] Connected");
                this.isConnected = true;
                if (this.onConnected) this.onConnected();
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                if (this.onDisconnected) this.onDisconnected();
            };

            this.ws.onerror = () => {
                if (this.onError) this.onError(new Error("WebSocket error"));
            };

            this.ws.onmessage = (evt) => {
                // Binary = raw PCM audio from agent
                if (evt.data instanceof ArrayBuffer) {
                    if (this.onAudioData) this.onAudioData(evt.data);
                    return;
                }
                // Text = JSON message
                try {
                    const msg = JSON.parse(evt.data);
                    switch (msg.type) {
                        case "input_transcript":
                            if (this.onInputTranscript) this.onInputTranscript(msg.text, msg.final);
                            break;
                        case "output_transcript":
                            if (this.onOutputTranscript) this.onOutputTranscript(msg.text, msg.final);
                            break;
                        case "agent_text":
                            if (this.onAgentText) this.onAgentText(msg.text, msg.partial);
                            break;
                        case "therapy_play":
                            if (this.onTherapyPlay) this.onTherapyPlay(msg.therapy_type);
                            break;
                        case "therapy_mix":
                            if (this.onTherapyMix) this.onTherapyMix(msg.layers);
                            break;
                        case "compose_raga":
                            if (this.onComposeRaga) this.onComposeRaga(msg);
                            break;
                        case "meditation_start":
                            if (this.onMeditationStart) this.onMeditationStart(msg.style, msg.duration_minutes, msg.focus_theme);
                            break;
                        case "meditation_end":
                            if (this.onMeditationEnd) this.onMeditationEnd();
                            break;
                        case "therapy_volume":
                            if (this.onTherapyVolume) this.onTherapyVolume(msg.volume);
                            break;
                        case "spotify_play":
                            if (this.onSpotifyPlay) this.onSpotifyPlay(msg.query);
                            break;
                        case "spotify_status":
                            if (this.onSpotifyStatus) this.onSpotifyStatus(msg.action);
                            break;
                        case "spotify_now_playing":
                            if (this.onSpotifyNowPlaying) this.onSpotifyNowPlaying(msg);
                            break;
                        case "wellness_score":
                            if (this.onWellnessScore) this.onWellnessScore(msg.score, msg.indicators);
                            break;
                        case "mood_assessed":
                            if (this.onMoodAssessed) this.onMoodAssessed(msg.emotion, msg.confidence, msg.facial_observations, msg.voice_observations);
                            break;
                        case "mood_changed":
                            if (this.onMoodChanged) this.onMoodChanged(msg.from_mood, msg.to_mood, msg.trigger, msg.observations);
                            break;
                        case "affirmation":
                            if (this.onAffirmation) this.onAffirmation(msg.text, msg.theme);
                            break;
                        case "session_insight":
                            if (this.onSessionInsight) this.onSessionInsight(msg.insight, msg.category);
                            break;
                        case "turn_complete":
                            if (this.onTurnComplete) this.onTurnComplete();
                            break;
                        case "interrupted":
                            if (this.onInterrupted) this.onInterrupted();
                            break;
                        case "status":
                            if (this.onStatus) this.onStatus(msg.status, msg.detail);
                            break;
                    }
                } catch (e) {
                    console.error("[WS] Parse error:", e);
                }
            };
        } catch (err) {
            if (this.onError) this.onError(err);
        }
    }

    sendAudio(pcmBuffer) {
        if (this.isConnected && this.ws) this.ws.send(pcmBuffer);
    }

    sendImage(frame) {
        if (this.isConnected && this.ws) {
            this.ws.send(JSON.stringify({
                type: "image",
                data: frame.data,
                mimeType: frame.mimeType,
            }));
        }
    }

    sendText(text) {
        if (this.isConnected && this.ws) {
            this.ws.send(JSON.stringify({ type: "text", text }));
        }
    }

    disconnect() {
        if (this.ws) { this.ws.close(1000); this.ws = null; }
        this.isConnected = false;
    }
}

window.WebSocketClient = WebSocketClient;
