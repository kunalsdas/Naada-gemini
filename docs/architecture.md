# Naada — Architecture

A deep dive into how everything fits together.

## System Overview

Naada is a real-time multimodal AI sound therapy companion. The user opens a browser, grants camera + mic access, and starts talking. The system sees their face, hears their voice, detects their emotional state, and plays personalized sound therapy — all in real-time through a single WebSocket connection.

The stack: **Browser → FastAPI WebSocket → ADK Runner → Gemini Live API** (bidirectional streaming).

## High-Level Flow

```
Browser (Camera + Mic)
    │
    ├── JPEG frames (every 3s) ──┐
    ├── PCM audio (16kHz) ───────┤
    │                            ▼
    │                    FastAPI WebSocket Server
    │                            │
    │                    ADK Runner (Bidi Mode)
    │                            │
    │                    Gemini 2.5 Flash Live API
    │                            │
    │                    Agent calls tools:
    │                    assess_mood, start_therapy,
    │                    compose_raga, update_wellness...
    │                            │
    ├── PCM audio (24kHz) ◄──────┤  (agent voice)
    ├── JSON commands ◄──────────┤  (therapy_play, mood_assessed, etc.)
    └── Transcripts ◄────────────┘  (what user said, what agent said)
```

## Backend Architecture

The backend is split into focused modules — each file does one thing.

```
backend/
├── main.py              (54 lines)   App bootstrap, middleware, router mounting
├── config.py            (39 lines)   Environment variables and constants
├── system_prompt.py     (383 lines)  Clinical instruction for the agent
├── agent.py             (39 lines)   Agent definition + model config
├── routes.py            (44 lines)   HTTP routes (health check, session, frontend)
├── websocket_handler.py (207 lines)  WebSocket endpoint, upstream/downstream tasks
├── event_processor.py   (248 lines)  ADK event → frontend message translation
├── spotify_control.py   (248 lines)  Spotify desktop control via AppleScript
└── tools/
    ├── __init__.py      (46 lines)   Exports ALL_TOOLS list
    ├── mood.py          (181 lines)  assess_mood, log_mood_change, wellness, summary
    ├── therapy.py       (195 lines)  start_therapy, mix, compose_raga, volume
    ├── meditation.py    (133 lines)  start/end meditation, affirmations, insights
    └── spotify.py       (130 lines)  spotify_play, control, now_playing
```

### How the pieces connect

1. **`main.py`** creates the FastAPI app, adds CORS middleware, mounts static files, and includes two routers: `routes.router` (HTTP) and `websocket_handler.router` (WebSocket + session API).

2. **`websocket_handler.py`** manages the WebSocket lifecycle. When a client connects, it spins up two concurrent tasks:
   - **Upstream**: receives browser messages (PCM audio bytes, JPEG frames, text) and forwards them to the ADK `LiveRequestQueue`
   - **Downstream**: iterates over ADK events from `runner.run_live()` and passes each to `event_processor.send_event_to_client()`

3. **`event_processor.py`** is the translation layer. It takes raw ADK events (which contain audio blobs, transcripts, and tool calls) and converts them into small, typed JSON messages the frontend understands. Tool calls are dispatched through a `TOOL_HANDLERS` dictionary — no more giant if/elif chain.

4. **`agent.py`** is just the wiring. It imports `ALL_TOOLS` from `tools/`, the system prompt from `system_prompt.py`, and creates the `root_agent` with model config and safety settings.

5. **`tools/`** package groups the 15 agent tools by domain:
   - **mood.py**: emotion detection, mood tracking, wellness scoring, session summaries
   - **therapy.py**: sound playback, mixing, generative raga composition, volume
   - **meditation.py**: guided meditation, affirmation cards, session insights
   - **spotify.py**: Spotify playback and control

## Frontend Architecture

The frontend is a single-page app with modular JavaScript using a mixin pattern.

```
frontend/
├── index.html                    Single HTML file (3 screens + overlays)
└── static/
    ├── css/style.css             Full design system (~3700 lines)
    ├── js/
    │   ├── app.js                NaadaApp class — orchestrator
    │   ├── constants.js          Therapy data, colors, frequency maps
    │   ├── therapy-controller.js TherapyController mixin (playback, mixer, DAF)
    │   ├── session-tracker.js    SessionTracker mixin (wellness, mood, courses)
    │   ├── ui-effects.js         UIEffects mixin (intro, SOS, breathing, effects)
    │   ├── therapy-audio.js      TherapyAudioEngine (17 sound types)
    │   ├── generative-audio.js   GenerativeSoundEngine (Karplus-Strong ragas)
    │   ├── visualizer.js         AudioVisualizer (radial bars + particles)
    │   ├── audio-processor.js    Mic capture + agent voice playback
    │   ├── camera.js             Camera stream + frame capture
    │   ├── heart-rate.js         rPPG heart rate from webcam
    │   ├── sound-journey.js      Session timeline canvas
    │   └── websocket-client.js   WebSocket protocol layer
    ├── audio/                    11 therapy MP3 files (~10 MB)
    ├── images/                   PWA icons
    ├── manifest.json             PWA manifest
    └── sw.js                     Service worker (offline caching)
```

### Mixin pattern

The main `NaadaApp` class in `app.js` is kept slim (~860 lines) by splitting domain logic into three mixin objects:

```javascript
Object.assign(NaadaApp.prototype, TherapyController, SessionTracker, UIEffects);
```

Each mixin is a plain object with methods that get mixed into the prototype. They share `this` context with the main class — so they can access `this.therapyEngine`, `this.ws`, etc. without any extra wiring.

### Audio engine

Two separate audio engines handle different sound types:

- **TherapyAudioEngine** (`therapy-audio.js`): Plays file-based sounds (bowls, ragas, rain, ocean) and synthesized clinical protocols (binaural beats, isochronic tones, notched noise, metronome, MIT melody). Uses `SOUND_MAP` for file-based and `SYNTH_MAP` for synthesized dispatch.

- **GenerativeSoundEngine** (`generative-audio.js`): Real-time algorithmic Indian classical music using Karplus-Strong string synthesis. Defines 8 ragas with proper aroha/avaroha, 7 instrument models, 5 talas, tanpura drone, and tabla percussion. Every note is procedurally generated.

### Audio ducking

When the agent speaks, therapy sounds duck to 8% volume. When the agent stops, they restore to 30%. If the user interrupts, all audio ducks for 3 seconds. This keeps the conversation clear while therapy stays ambient.

## WebSocket Protocol

All communication happens over a single WebSocket at `/ws/{user_id}/{session_id}`.

### Client → Server

| Frame type | Content | Purpose |
|-----------|---------|---------|
| Binary | Raw PCM bytes | Microphone audio (16kHz, 16-bit, mono) |
| Text | `{"type": "image", "data": "<base64>", "mimeType": "image/jpeg"}` | Camera frame |
| Text | `{"type": "text", "text": "..."}` | Text message |

### Server → Client

| Frame type | Content | Purpose |
|-----------|---------|---------|
| Binary | Raw PCM bytes | Agent voice (24kHz, 16-bit, mono) |
| Text | `{"type": "therapy_play", "therapy_type": "..."}` | Start therapy sound |
| Text | `{"type": "therapy_mix", "layers": [...]}` | Play layered sounds |
| Text | `{"type": "compose_raga", "raga": "...", ...}` | Start generative music |
| Text | `{"type": "mood_assessed", "emotion": "..."}` | Mood detection result |
| Text | `{"type": "wellness_score", "score": N}` | Wellness gauge update |
| Text | `{"type": "affirmation", "text": "..."}` | Display affirmation card |
| Text | `{"type": "session_insight", "insight": "..."}` | Floating insight toast |
| Text | `{"type": "input_transcript", "text": "..."}` | What the user said |
| Text | `{"type": "output_transcript", "text": "..."}` | What the agent said |
| Text | `{"type": "turn_complete"}` | Agent finished speaking |
| Text | `{"type": "interrupted"}` | User interrupted agent |

## ADK Configuration

```python
RunConfig(
    streaming_mode=StreamingMode.BIDI,
    response_modalities=["AUDIO"],
    speech_config=SpeechConfig(voice="Kore"),
    input_audio_transcription=True,
    output_audio_transcription=True,
    realtime_input_config=RealtimeInputConfig(
        automatic_activity_detection=AutomaticActivityDetection(
            start_of_speech_sensitivity=HIGH,
            end_of_speech_sensitivity=HIGH,
            silence_duration_ms=500,
            prefix_padding_ms=300,
        )
    ),
)
```

Key choices:
- **BIDI streaming** — audio flows both ways simultaneously
- **AUDIO response modality** — Gemini speaks, doesn't type
- **Kore voice** — warm, calm voice for a therapy persona
- **High speech sensitivity** — picks up the user quickly for natural conversation
- **500ms silence duration** — waits half a second before deciding the user stopped talking

## Deployment

The app deploys to Google Cloud Run as a single container.

- **Dockerfile**: Python 3.11 slim, installs deps, copies backend + frontend, runs uvicorn on port 8080
- **Session affinity**: enabled so WebSocket connections stick to the same instance
- **Auto-scaling**: 0–10 instances, scales to zero when idle
- **Health check**: `GET /health` returns app status
- **Single worker**: 1 uvicorn worker per instance to avoid WebSocket conflicts

## Security & Privacy

- Camera frames processed in real-time, never stored
- Audio streams processed in real-time, never recorded (unless user explicitly saves)
- Session data lives in memory only (`InMemorySessionService`) — gone when the session ends
- All data encrypted in transit (HTTPS/WSS)
- No personal data collected, no cookies, no tracking
- Safety settings configured for therapy-appropriate content
