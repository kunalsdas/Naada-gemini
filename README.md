# Naada — AI Sound Therapy Companion

> A real-time voice + vision AI agent that sees your emotions, hears your voice, and heals you with personalized sound therapy.

[![Built with Gemini Live API + ADK](https://img.shields.io/badge/Built%20with-Gemini%20Live%20API%20%2B%20ADK-orange)]()
[![Deployed on Google Cloud Run](https://img.shields.io/badge/Deployed%20on-Google%20Cloud%20Run-green)]()
[![Hackathon: Gemini Live Agent Challenge](https://img.shields.io/badge/Hackathon-Gemini%20Live%20Agent%20Challenge-purple)]()

---

## What's the Problem?

77% of the global workforce reports physical symptoms caused by stress (Gallup). Mental health services are expensive, hard to access, and often stigmatized. Meanwhile, sound healing traditions — Tibetan singing bowls, Indian ragas, binaural beats — have centuries of practice and growing scientific backing, but they need trained practitioners.

There's no accessible, real-time tool that can **see how you're feeling**, **listen to your voice**, and **respond with the right sounds to help you heal** — all from a browser, no downloads needed.

## How Naada Solves It

**Naada** (from Sanskrit "नाद" — cosmic vibration) turns any device into a personal sound therapy studio:

1. **Sees you** — Camera reads your facial expressions and detects tension, stress, or calm
2. **Hears you** — Voice AI listens to your tone, pace, and words naturally
3. **Talks to you** — A gentle, warm AI companion guides you through therapy
4. **Heals you** — Plays scientifically-tuned sounds adapted to your detected mood in real-time

No typing, no menus. Just talk, listen, and heal.

## What Makes It Special

- **17 therapy sound types** — from Tibetan bowls and Indian ragas to clinical protocols for ADHD, PTSD, tinnitus, Parkinson's, and more
- **Live generative music** — AI composes unique Indian classical ragas in real-time using Karplus-Strong string synthesis. Every performance is different.
- **Real-time wellness scoring** — watches your face and tracks stress reduction with a live gauge
- **Guided meditation** — 5 styles (breathing, body scan, visualization, loving kindness, mantra)
- **Sound mixing** — layers multiple therapy sounds together for personalized soundscapes
- **Clinical condition protocols** — evidence-based therapies for 10 conditions (stuttering, ADHD, PTSD, chronic pain, etc.)
- **PWA** — installable, works offline for cached content
- **30+ languages** — speaks in English, Hindi, Sanskrit, Tamil, Bengali, and more
- **Spotify integration** — plays real music alongside therapy sounds

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER'S BROWSER                        │
│                                                          │
│   Camera ──┐    Mic ──┐     Web Audio Engine             │
│   (face    │   (voice)│     ├─ 17 therapy sound types    │
│    emotion)│   16kHz  │     ├─ Generative raga composer  │
│            │          │     ├─ Visualizer + particles    │
│            │          │     └─ Agent voice (24kHz)       │
│            │          │                                   │
│   ┌────────┴──────────┴──────────────────────────────┐   │
│   │  WebSocket Client (binary PCM + JSON messages)    │   │
│   └──────────────────────┬───────────────────────────┘   │
└──────────────────────────┼───────────────────────────────┘
                           │ wss://
┌──────────────────────────┼───────────────────────────────┐
│              GOOGLE CLOUD RUN                             │
│                          │                                │
│   ┌──────────────────────┴───────────────────────────┐   │
│   │  FastAPI + WebSocket Server                       │   │
│   │  ├─ routes.py          (HTTP endpoints)           │   │
│   │  ├─ websocket_handler  (bidi streaming)           │   │
│   │  └─ event_processor    (tool call → frontend)     │   │
│   └──────────────────────┬───────────────────────────┘   │
│                          │                                │
│   ┌──────────────────────┴───────────────────────────┐   │
│   │  ADK Runner (Bidi Streaming)                      │   │
│   │  └─ Naada Agent (15 tools + Google Search)        │   │
│   │     ├─ tools/mood.py       (emotion tracking)     │   │
│   │     ├─ tools/therapy.py    (sound + raga control) │   │
│   │     ├─ tools/meditation.py (meditation + cards)   │   │
│   │     └─ tools/spotify.py    (Spotify playback)     │   │
│   └──────────────────────────────────────────────────┘   │
└──────────────────────────┬───────────────────────────────┘
                           │ Bidi Stream
┌──────────────────────────┴───────────────────────────────┐
│                    GEMINI LIVE API                         │
│  Model: gemini-2.5-flash-native-audio-preview             │
│  Vision + Audio + Tool Calling + Interruption Handling    │
└───────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Tech |
|-------|------|
| AI Model | Gemini 2.5 Flash (Native Audio) via Live API |
| Agent Framework | Google ADK with Bidi Streaming |
| Backend | Python 3.11, FastAPI, WebSockets |
| Frontend | Vanilla JS, Web Audio API, Canvas |
| Deployment | Google Cloud Run (auto-scaling 0–10) |
| CI/CD | Google Cloud Build |
| Audio Synthesis | Karplus-Strong, binaural beats, isochronic tones, MIT melodic therapy |
| Integrations | Spotify Desktop, Google Search |

## Project Structure

```
naada/
├── backend/
│   ├── main.py                 # App entry point — FastAPI bootstrap
│   ├── config.py               # Environment variables and constants
│   ├── system_prompt.py        # Clinical instruction for the agent
│   ├── agent.py                # Agent definition + model config
│   ├── routes.py               # HTTP routes (health, session, frontend)
│   ├── websocket_handler.py    # WebSocket endpoint + streaming
│   ├── event_processor.py      # Tool call interception → frontend messages
│   ├── spotify_control.py      # Spotify AppleScript automation
│   ├── tools/
│   │   ├── __init__.py         # Exports all 15 tools
│   │   ├── mood.py             # assess_mood, log_mood_change, wellness score
│   │   ├── therapy.py          # start_therapy, mix, raga composition, volume
│   │   ├── meditation.py       # meditation, affirmations, session insights
│   │   └── spotify.py          # Spotify playback and control
│   └── requirements.txt
├── frontend/
│   ├── index.html              # Single-page app (3 screens + overlays)
│   └── static/
│       ├── css/style.css       # Full design system
│       ├── js/
│       │   ├── app.js               # Main orchestrator (NaadaApp class)
│       │   ├── constants.js         # Therapy data, colors, frequency maps
│       │   ├── therapy-controller.js # Therapy playback + UI mixin
│       │   ├── session-tracker.js   # Wellness, mood, courses mixin
│       │   ├── ui-effects.js        # Intro, SOS, breathing, effects mixin
│       │   ├── therapy-audio.js     # Web Audio engine (17 therapy types)
│       │   ├── generative-audio.js  # Karplus-Strong raga composer
│       │   ├── visualizer.js        # Radial frequency bars + particles
│       │   ├── audio-processor.js   # Mic capture + voice playback
│       │   ├── camera.js            # Camera stream + frame capture
│       │   ├── heart-rate.js        # rPPG heart rate estimation
│       │   ├── sound-journey.js     # Session timeline canvas
│       │   └── websocket-client.js  # WebSocket protocol layer
│       ├── audio/               # 11 therapy MP3 files (~10 MB)
│       ├── images/              # PWA icons
│       ├── manifest.json        # PWA manifest
│       └── sw.js                # Service worker
├── deploy/
│   ├── deploy.sh               # One-command Cloud Run deployment
│   └── cloudbuild.yaml         # CI/CD pipeline
├── docs/
│   └── architecture.md         # Detailed architecture docs
├── Dockerfile                  # Cloud Run container config
├── .gitignore
└── README.md
```

## Agent Tools (16)

| Tool | What it does |
|------|-------------|
| `assess_mood` | Detects emotion from face + voice with confidence scoring |
| `start_therapy` | Plays one of 17 therapy sound types |
| `mix_therapy` | Layers multiple sounds with custom volume levels |
| `compose_raga` | Generates live Indian classical music (8 ragas, 5 instruments) |
| `start_meditation` | Launches guided meditation (5 styles, timed) |
| `end_meditation` | Ends meditation and returns to normal mode |
| `adjust_therapy_volume` | Changes sound volume dynamically |
| `update_wellness_score` | Tracks real-time stress score from facial cues |
| `log_mood_change` | Records emotional progression during therapy |
| `get_session_summary` | Summarizes the mood journey and therapies used |
| `show_affirmation` | Displays personalized healing affirmation cards |
| `share_session_insight` | Shows real-time clinical observations as toasts |
| `spotify_play` | Plays Spotify music (mood playlists or search) |
| `spotify_control_playback` | Pause, resume, skip, volume |
| `spotify_now_playing` | Gets current track info |
| `google_search` | Grounds responses with web search |

## Quick Start

### What you need
- Python 3.11+
- A Gemini API key — [get one here](https://aistudio.google.com/apikey)
- Chrome browser (for Web Audio API)
- (Optional) Spotify desktop app

### Setup

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/naada.git
cd naada

# Create a virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Set up your API key
# Create .env file with: GOOGLE_API_KEY=your_key_here
```

### Run locally

```bash
cd backend
python main.py
```

Open **http://localhost:8080** in Chrome. Click "Begin Your Session", pick your language, allow camera + mic, and just start talking.

## Deploy to Google Cloud Run

### Quick deploy (one command)

```bash
export GOOGLE_CLOUD_PROJECT=challenge-489019
export GOOGLE_API_KEY=your-api-key

chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

### Manual deploy

```bash
# Set the project
gcloud config set project challenge-489019

# Enable APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# Create Artifact Registry repo (first time only)
gcloud artifacts repositories create naada --repository-format=docker --location=us-central1 --quiet

# Build the container
gcloud builds submit --tag us-central1-docker.pkg.dev/challenge-489019/naada/naada:latest --timeout=600

# Deploy
gcloud run deploy naada \
  --image us-central1-docker.pkg.dev/challenge-489019/naada/naada:latest \
  --platform managed \
  --region us-central1 \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --set-env-vars "GOOGLE_API_KEY=YOUR_KEY,GOOGLE_CLOUD_PROJECT=challenge-489019,GOOGLE_CLOUD_LOCATION=us-central1" \
  --allow-unauthenticated \
  --session-affinity
```

## How It Works (The Flow)

1. You open Naada — a cinematic intro welcomes you with speech synthesis
2. You grant camera + microphone access
3. Camera frames go to Gemini every 3 seconds for emotion analysis
4. Your voice streams continuously as 16kHz PCM audio
5. Gemini sees your face, hears your voice, and figures out how you're feeling
6. The agent picks the right therapy — bowls for stress, ragas for sadness, delta waves for sleep
7. Therapy sounds play through Web Audio API with real-time visualization
8. You can interrupt anytime — just start talking and Naada listens immediately
9. Your mood is tracked throughout with a live wellness score gauge
10. As your stress drops, the agent adapts — switching sounds, offering affirmations, guiding meditation

## Why Naada Stands Out

**No text boxes.** You never type anything. Just talk, and an AI that can see and hear you responds with the exact sounds your mind needs right now.

**Clinically informed.** Every therapy type maps to real research — binaural beats for focus (Chaieb et al.), Tibetan bowls for anxiety (Goldsby et al.), 40Hz gamma for Alzheimer's (Tsai Lab, MIT), DAF for stuttering (Kalinowski et al.).

**Generative, not canned.** The raga composer creates genuinely unique music every time using Karplus-Strong string synthesis. No two sessions sound the same.

**Works everywhere.** Browser-based, PWA-installable, runs on phones and laptops. No app store, no downloads.

---

*Naada: Ancient healing wisdom meets modern AI. Just talk, listen, and heal.*

Built for the **Gemini Live Agent Challenge** hackathon.
