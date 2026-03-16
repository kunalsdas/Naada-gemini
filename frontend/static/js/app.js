/**
 * Naada — Main Application Orchestrator
 * Composes modules: constants, therapy-controller, session-tracker, ui-effects
 */

class NaadaApp {
    constructor() {
        this.audio = new AudioProcessor();
        this.camera = new CameraHandler();
        this.ws = new WebSocketClient();
        this.therapy = new TherapyAudioEngine();
        this.generative = new GenerativeSoundEngine(this.therapy);
        this.isSessionActive = false;
        this.isCameraVisible = true;
        this.isMeditationMode = false;

        this._selectedLanguage = null;
        this._selectedEnvironment = null;
        this._lastOutputBubble = null;
        this._lastInputBubble = null;
        this._chipTimeout = null;
        this._moodJourney = [];
        this._currentMood = "neutral";
        this._breathingInterval = null;
        this._initialWellnessScore = null;
        this._currentWellnessScore = null;
        this._wellnessScores = [];
        this._therapiesUsed = [];
        this._sosActive = false;
        this._selectedCondition = null;
        this._neurotonesProfile = null;
        this._freqMatrixOpen = false;
        this._freqMatrixRAF = null;
        this._agentIsSpeaking = false;
        this._interruptCooldown = false;
        this._heartRate = null;
        this._voiceRmsHistory = [];
        this._soundJourney = null;

        this._bindElements();
        this._bindEvents();

        this._visualizer = new AudioVisualizer("audio-visualizer", this.therapy);
        this._particles = new ParticleSystem("particles-canvas", this.therapy);
        this._emotionRadar = new EmotionRadar("emotion-radar-canvas");
        this._soundJourney = new SoundJourneyTimeline("sound-journey-canvas");

        this.therapy.preload().catch(e => console.warn("[Naada] Preload warning:", e));

        this._bgMusicStarted = false;
        this._startBgMusicOnInteraction();
        // Delay streak/heatmap until intro completes so landing feels clean
        this._playIntroSequence().then(() => {
            this._showStreak();
            this._renderHeatmap();
        }).catch(e => {
            console.error("[Naada] Intro error:", e);
            this._showStreak();
            this._renderHeatmap();
        });
    }

    _bindElements() {
        this.el = {
            landingScreen: document.getElementById("landing-screen"),
            agentScreen: document.getElementById("agent-screen"),
            startBtn: document.getElementById("start-btn"),
            statusDot: document.getElementById("status-dot"),
            statusText: document.getElementById("status-text"),
            cameraToggleBtn: document.getElementById("camera-toggle-btn"),
            endSessionBtn: document.getElementById("end-session-btn"),
            cameraContainer: document.getElementById("camera-container"),
            cameraOverlay: document.getElementById("camera-overlay"),
            agentStatusText: document.getElementById("agent-status-text"),
            transcriptContent: document.getElementById("transcript-content"),
            transcriptArea: document.getElementById("transcript-area"),
            micBtn: document.getElementById("mic-btn"),
            micHint: document.getElementById("mic-hint"),
            errorModal: document.getElementById("error-modal"),
            errorTitle: document.getElementById("error-title"),
            errorMessage: document.getElementById("error-message"),
            errorRetryBtn: document.getElementById("error-retry-btn"),
            moodBg: document.getElementById("mood-bg"),
            therapyIndicator: document.getElementById("therapy-indicator"),
            therapyIcon: document.getElementById("therapy-icon"),
            therapyLabel: document.getElementById("therapy-label"),
            therapyLabelText: document.getElementById("therapy-label-text"),
            stopTherapyBtn: document.getElementById("stop-therapy-btn"),
            saveSoundBtn: document.getElementById("save-sound-btn"),
            moodChips: document.getElementById("mood-chips"),
            analyzeMoodBtn: document.getElementById("analyze-mood-btn"),
            coursesBtn: document.getElementById("courses-btn"),
            courseOverlay: document.getElementById("course-overlay"),
            closeCourseBtn: document.getElementById("close-courses-btn"),
            courseList: document.getElementById("course-list"),
            sessionTimer: document.getElementById("session-timer"),
            sessionTimerText: document.getElementById("session-timer-text"),
            langOverlay: document.getElementById("lang-overlay"),
            envOverlay: document.getElementById("env-overlay"),
            spotifyBar: document.getElementById("spotify-bar"),
            spotifyTrack: document.getElementById("spotify-track"),
            spotifyArtist: document.getElementById("spotify-artist"),
            audioVisualizerCanvas: document.getElementById("audio-visualizer"),
            particlesCanvas: document.getElementById("particles-canvas"),
            breathingGuide: document.getElementById("breathing-guide"),
            breathingLabel: document.getElementById("breathing-label"),
            breathingCount: document.getElementById("breathing-count"),
            moodJourney: document.getElementById("mood-journey"),
            moodJourneyTimeline: document.getElementById("mood-journey-timeline"),
            perceptionPanel: document.getElementById("perception-panel"),
            facialTags: document.getElementById("facial-tags"),
            voiceTags: document.getElementById("voice-tags"),
            confidenceBar: document.getElementById("confidence-bar"),
            confidenceValue: document.getElementById("confidence-value"),
            perceptionPulse: document.getElementById("perception-pulse"),
            stressMeter: document.getElementById("stress-meter"),
            relaxMeter: document.getElementById("relax-meter"),
            emotionRadar: document.getElementById("emotion-radar"),
            emotionRadarCanvas: document.getElementById("emotion-radar-canvas"),
            wellnessGauge: document.getElementById("wellness-gauge"),
            wellnessRingFill: document.getElementById("wellness-ring-fill"),
            wellnessScoreNumber: document.getElementById("wellness-score-number"),
            wellnessImprovement: document.getElementById("wellness-improvement"),
            wellnessImprovementText: document.getElementById("wellness-improvement-text"),
            therapyScience: document.getElementById("therapy-science"),
            scienceHz: document.getElementById("science-hz"),
            scienceName: document.getElementById("science-name"),
            scienceDesc: document.getElementById("science-desc"),
            scienceEvidence: document.getElementById("science-evidence"),
            sosBtn: document.getElementById("sos-btn"),
            groundingOverlay: document.getElementById("grounding-overlay"),
            closeGroundingBtn: document.getElementById("close-grounding-btn"),
            biometricsBar: document.getElementById("biometrics-bar"),
            heartRateValue: document.getElementById("heart-rate-value"),
            voiceStressValue: document.getElementById("voice-stress-value"),
            voiceStressBar: document.getElementById("voice-stress-bar"),
            coherenceValue: document.getElementById("coherence-value"),
            screenTherapy: document.getElementById("screen-therapy"),
            soundJourney: document.getElementById("sound-journey"),
            soundJourneyElapsed: document.getElementById("sound-journey-elapsed"),
            soundJourneyCanvas: document.getElementById("sound-journey-canvas"),
            sessionReport: document.getElementById("session-report"),
            reportScoreBefore: document.getElementById("report-score-before"),
            reportScoreAfter: document.getElementById("report-score-after"),
            reportImprovementText: document.getElementById("report-improvement-text"),
            reportMoodFlow: document.getElementById("report-mood-flow"),
            reportTherapies: document.getElementById("report-therapies"),
            reportObservations: document.getElementById("report-observations"),
            reportRecommendation: document.getElementById("report-recommendation"),
            reportAvgBpm: document.getElementById("report-avg-bpm"),
            reportCoherence: document.getElementById("report-coherence"),
            reportHrTrend: document.getElementById("report-hr-trend"),
            closeReportBtn: document.getElementById("close-report-btn"),
            shareReportBtn: document.getElementById("share-report-btn"),
            affirmationCard: document.getElementById("affirmation-card"),
            affirmationText: document.getElementById("affirmation-text"),
            chakraMap: document.getElementById("chakra-map"),
            streakBadge: document.getElementById("streak-badge"),
            streakCount: document.getElementById("streak-count"),
            mixerPad: document.getElementById("mixer-pad"),
            mixerGrid: document.getElementById("mixer-grid"),
            closeMixerBtn: document.getElementById("close-mixer-btn"),
            mixerPlayBtn: document.getElementById("mixer-play-btn"),
            mixerBtn: document.getElementById("mixer-btn"),
            moodHeatmap: document.getElementById("mood-heatmap"),
            heatmapGrid: document.getElementById("heatmap-grid"),
            zenBubble: document.getElementById("zen-bubble"),
            zenOrb: document.getElementById("zen-orb"),
            zenOrbText: document.getElementById("zen-orb-text"),
            zenOverlay: document.getElementById("zen-overlay"),
            zenBreathCircle: document.getElementById("zen-breath-circle"),
            zenBreathLabel: document.getElementById("zen-breath-label"),
            zenBreathTimer: document.getElementById("zen-breath-timer"),
            closeZenBtn: document.getElementById("close-zen-btn"),
            insightToast: document.getElementById("insight-toast"),
            insightText: document.getElementById("insight-text"),
            conditionSelector: document.getElementById("condition-selector"),
            neurotonesBtn: document.getElementById("neurotone-btn"),
            neurotonesOverlay: document.getElementById("neurotone-overlay"),
            closeNeurotonesBtn: document.getElementById("close-neurotone-btn"),
            neurotonesScanning: document.getElementById("neurotone-scanning"),
            neurotonesResult: document.getElementById("neurotone-result"),
            neurotonesProgressFill: document.getElementById("neurotone-progress-fill"),
            neurotonesFreqNumber: document.getElementById("neurotone-freq-number"),
            neurotonesVoiceType: document.getElementById("neurotone-voice-type"),
            neurotonesResonanceFill: document.getElementById("neurotone-resonance-fill"),
            neurotonesResonancePct: document.getElementById("neurotone-resonance-pct"),
            neurotoneseSolfeggioHz: document.getElementById("neurotone-solfeggio-hz"),
            neurotoneseSolfeggioName: document.getElementById("neurotone-solfeggio-name"),
            neurotoneBrainwave: document.getElementById("neurotone-brainwave"),
            neurotonesPlayBtn: document.getElementById("neurotone-play-btn"),
            freqMatrixBtn: document.getElementById("freqmatrix-btn"),
            freqMatrixOverlay: document.getElementById("freqmatrix-overlay"),
            closeFreqMatrixBtn: document.getElementById("close-freqmatrix-btn"),
            freqMatrixCanvas: document.getElementById("freqmatrix-spectrum"),
            bwCurrentTherapy: document.getElementById("bw-current-therapy"),
            bwTherapyText: document.getElementById("bw-therapy-text"),
            fmfTherapy: document.getElementById("fmf-therapy"),
            fmfTargetHz: document.getElementById("fmf-target-hz"),
            fmfBrainwave: document.getElementById("fmf-brainwave"),
            fmfEffect: document.getElementById("fmf-effect"),
            solfNeurotoneMarker: document.getElementById("solf-neurotone-marker"),
            solfUserHz: document.getElementById("solf-user-hz"),
            dafPanel: document.getElementById("daf-panel"),
            dafDelayValue: document.getElementById("daf-delay-value"),
            dafDelaySlider: document.getElementById("daf-delay-slider"),
            dafToggleBtn: document.getElementById("daf-toggle-btn"),
            dafToggleLabel: document.getElementById("daf-toggle-label"),
        };
    }

    _bindEvents() {
        // Core session controls
        this.el.startBtn.addEventListener("click", () => this.startSession());
        this.el.cameraToggleBtn.addEventListener("click", () => this.toggleCamera());
        this.el.endSessionBtn.addEventListener("click", () => this.endSession());
        this.el.micBtn.addEventListener("click", () => this.toggleMic());
        if (this.el.errorRetryBtn) this.el.errorRetryBtn.addEventListener("click", () => {
            if (this.el.errorModal) this.el.errorModal.style.display = "none";
            this.startSession();
        });
        if (this.el.stopTherapyBtn) this.el.stopTherapyBtn.addEventListener("click", () => this.stopTherapy());
        if (this.el.saveSoundBtn) this.el.saveSoundBtn.addEventListener("click", () => this.toggleSaveSound());
        if (this.el.sosBtn) this.el.sosBtn.addEventListener("click", () => this._activateSOS());
        if (this.el.closeGroundingBtn) this.el.closeGroundingBtn.addEventListener("click", () => this._deactivateSOS());
        if (this.el.shareReportBtn) this.el.shareReportBtn.addEventListener("click", () => this._shareSessionCard());
        if (this.el.closeReportBtn) this.el.closeReportBtn.addEventListener("click", () => {
            if (this.el.sessionReport) this.el.sessionReport.style.display = "none";
            this._showScreen("landing");
        });

        // Condition selector
        document.querySelectorAll(".condition-chip").forEach(chip => {
            chip.addEventListener("click", () => this._onConditionSelected(chip));
        });

        // Neurotone
        if (this.el.neurotonesBtn) this.el.neurotonesBtn.addEventListener("click", () => this._openNeurotoneOverlay());
        if (this.el.closeNeurotonesBtn) this.el.closeNeurotonesBtn.addEventListener("click", () => this._closeNeurotoneOverlay());
        if (this.el.neurotonesPlayBtn) this.el.neurotonesPlayBtn.addEventListener("click", () => this._playNeurotoneTherapy());

        // Frequency matrix
        if (this.el.freqMatrixBtn) this.el.freqMatrixBtn.addEventListener("click", () => this._openFreqMatrix());
        if (this.el.closeFreqMatrixBtn) this.el.closeFreqMatrixBtn.addEventListener("click", () => this._closeFreqMatrix());

        // DAF
        if (this.el.dafToggleBtn) this.el.dafToggleBtn.addEventListener("click", () => this._toggleDAF());
        if (this.el.dafDelaySlider) this.el.dafDelaySlider.addEventListener("input", (e) => {
            const ms = parseInt(e.target.value);
            if (this.el.dafDelayValue) this.el.dafDelayValue.textContent = ms + "ms";
            this.therapy.setDAFDelay(ms / 1000);
        });
        document.querySelectorAll(".daf-tech-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".daf-tech-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                const delay = parseInt(btn.dataset.delay);
                if (this.el.dafDelaySlider) this.el.dafDelaySlider.value = delay;
                if (this.el.dafDelayValue) this.el.dafDelayValue.textContent = delay + "ms";
                this.therapy.setDAFDelay(delay / 1000);
            });
        });

        // Sound mixer
        if (this.el.mixerBtn) this.el.mixerBtn.addEventListener("click", () => this._showMixer());
        if (this.el.closeMixerBtn) this.el.closeMixerBtn.addEventListener("click", () => this._hideMixer());
        if (this.el.mixerPlayBtn) this.el.mixerPlayBtn.addEventListener("click", () => this._playMixerSelection());
        if (this.el.mixerGrid) {
            this.el.mixerGrid.querySelectorAll(".mixer-tile").forEach(tile => {
                tile.addEventListener("click", () => this._toggleMixerTile(tile));
            });
        }

        // Zen bubble
        if (this.el.zenOrb) this.el.zenOrb.addEventListener("click", () => this._startZenMeditation());
        if (this.el.closeZenBtn) this.el.closeZenBtn.addEventListener("click", () => this._stopZenMeditation());

        // Courses
        if (this.el.coursesBtn) this.el.coursesBtn.addEventListener("click", () => this._showCourses());
        if (this.el.closeCourseBtn) this.el.closeCourseBtn.addEventListener("click", () => {
            if (this.el.courseOverlay) this.el.courseOverlay.style.display = "none";
        });

        // Mood chips
        document.querySelectorAll(".mood-chip").forEach(chip => {
            chip.addEventListener("click", () => this._onMoodChipSelected(chip.dataset.mood));
        });
        if (this.el.analyzeMoodBtn) this.el.analyzeMoodBtn.addEventListener("click", () => this._onAnalyzeMoodClicked());

        // Language selection
        document.querySelectorAll(".lang-chip").forEach(chip => {
            chip.addEventListener("click", () => this._onLanguageSelected(chip.dataset.lang));
        });
        const langDropdown = document.getElementById("lang-dropdown");
        if (langDropdown) {
            langDropdown.addEventListener("change", (e) => {
                if (e.target.value) this._onLanguageSelected(e.target.value);
            });
        }

        // Environment selection
        document.querySelectorAll(".env-chip").forEach(chip => {
            chip.addEventListener("click", () => this._onEnvironmentSelected(chip.dataset.env));
        });

        // WebSocket callbacks
        this._bindWebSocketCallbacks();

        // Audio callbacks
        this.audio.onAudioData = (buffer) => { this.ws.sendAudio(buffer); };
        this.audio.onVoiceActivity = (rms) => this._handleVoiceActivity(rms);
    }

    _bindWebSocketCallbacks() {
        this.ws.onConnected = () => {
            this.isSessionActive = true;
            this._setStatus("connected");
            this.audio.startCapture();

            const langName = {
                en: "English", hi: "Hindi", sa: "Sanskrit", pa: "Punjabi", bn: "Bengali", ta: "Tamil",
                es: "Spanish", fr: "French", de: "German", pt: "Portuguese", it: "Italian",
                ru: "Russian", zh: "Chinese", ja: "Japanese", ko: "Korean", ar: "Arabic",
                tr: "Turkish", th: "Thai", vi: "Vietnamese", id: "Indonesian", ms: "Malay",
                te: "Telugu", mr: "Marathi", gu: "Gujarati", kn: "Kannada", ml: "Malayalam",
                ur: "Urdu", ne: "Nepali", si: "Sinhala", sw: "Swahili", pl: "Polish",
                nl: "Dutch", sv: "Swedish", da: "Danish", no: "Norwegian", fi: "Finnish",
                el: "Greek", he: "Hebrew", uk: "Ukrainian", ro: "Romanian", hu: "Hungarian",
                cs: "Czech", fil: "Filipino",
            };
            const envLabel = { home: "at home", office: "in the office", outdoors: "outdoors/market", commute: "commuting", gym: "at the gym", nature: "in nature" };

            const lang = this._selectedLanguage || "en";
            const env = this._selectedEnvironment || "home";
            this.ws.sendText(`[SYSTEM CONTEXT] User language: ${langName[lang] || lang}. You MUST speak ONLY in ${langName[lang] || "English"} throughout this ENTIRE session. Do NOT switch to any other language, even if the user speaks in a different language. Always respond in ${langName[lang] || "English"} only. User is currently ${envLabel[env] || env}. Adapt sounds and voice guidance for this environment.`);

            this.el.moodChips.style.display = "block";
            this._chipTimeout = setTimeout(() => {
                if (this.el.moodChips.style.display !== "none") this._startCameraAnalysis();
            }, 15000);
            this._addBubble("Welcome! Tap how you're feeling, or let me analyze your mood.", "system");
            this._setAgentStatus("sensing");

            if (this.el.zenBubble) this.el.zenBubble.style.display = "block";
            if (this.el.neurotonesBtn) this.el.neurotonesBtn.style.display = "flex";
            if (this.el.freqMatrixBtn) this.el.freqMatrixBtn.style.display = "flex";

            if (this._selectedCondition) {
                setTimeout(() => {
                    this.ws.sendText(`[SYSTEM CONTEXT] User has selected a specific condition: ${this._selectedCondition}. Please tailor the therapy protocol accordingly. For stuttering/stammer: consider recommending DAF therapy. For ADHD: adhd_smr. For PTSD: ptsd_theta. For Parkinson's: parkinsons_ras. For tinnitus: tinnitus_mask. For chronic pain: chronic_pain_delta. For aphasia: aphasia_melody. For Alzheimer's/memory: gamma_40hz.`);
                }, 1500);
            }
        };

        this.ws.onDisconnected = () => {
            this._setStatus("disconnected");
            this.audio.stopCapture();
            clearInterval(this._autoCaptureId);
            // Auto-reconnect if session was active (unexpected disconnect)
            if (this.isSessionActive && !this._endingSession) {
                this._addBubble("Connection lost. Reconnecting...", "system");
                this._reconnectAttempts = (this._reconnectAttempts || 0) + 1;
                if (this._reconnectAttempts <= 3) {
                    setTimeout(() => {
                        if (this.isSessionActive && !this._endingSession) {
                            this._connectSession();
                        }
                    }, 1500 * this._reconnectAttempts);
                } else {
                    this._addBubble("Could not reconnect. Please start a new session.", "system");
                    this._reconnectAttempts = 0;
                    this.endSession();
                }
            }
        };

        this.ws.onError = (err) => { this._showError("Connection Error", err.message || "Unable to connect."); };

        this.ws.onAudioData = (pcmBuffer) => {
            this.audio.playAgentAudio(pcmBuffer);
            this._agentIsSpeaking = true;
            this._setAgentStatus("speaking");
            this._duckBgMusic();
            if (this.isMeditationMode) this.therapy.meditationDuck();
            else this.therapy.duck();
            this.generative.duck();
        };

        this.ws.onInputTranscript = (text, isFinal) => {
            if (!text) return;
            if (isFinal) {
                if (this._lastInputBubble) { this._lastInputBubble.textContent = text; this._lastInputBubble = null; }
                else this._addBubble(text, "user");
            } else {
                if (this._lastInputBubble) this._lastInputBubble.textContent = text;
                else this._lastInputBubble = this._addBubble(text, "user");
            }
            this._scrollToBottom();
        };

        this.ws.onOutputTranscript = (text, isFinal) => {
            if (!text) return;
            if (isFinal) {
                if (this._lastOutputBubble) { this._lastOutputBubble.textContent = text; this._lastOutputBubble = null; }
                else this._addBubble(text, "agent");
            } else {
                if (this._lastOutputBubble) this._lastOutputBubble.textContent = text;
                else this._lastOutputBubble = this._addBubble(text, "agent");
            }
            this._scrollToBottom();
        };

        this.ws.onAgentText = (text) => { if (text) this._addBubble(text, "agent"); };

        this.ws.onTherapyVolume = (vol) => {
            this.therapy.setVolume(vol);
            this._addBubble(`Volume: ${Math.round(vol * 100)}%`, "system");
        };

        this.ws.onTherapyPlay = (therapyType) => {
            this.el.moodChips.style.display = "none";
            clearTimeout(this._chipTimeout);
            this._startTherapySound(therapyType);
        };

        this.ws.onTherapyMix = (layers) => {
            this.el.moodChips.style.display = "none";
            clearTimeout(this._chipTimeout);
            const names = layers.map(l => l.type).join(" + ");
            this.therapy.playMix(layers, 0.3).catch(e => console.warn("[Naada] Mix play error:", e));
            this.el.therapyIndicator.classList.add("active");
            this.el.therapyIcon.textContent = "music_note";
            this.el.therapyLabel.style.display = "flex";
            this.el.therapyLabelText.textContent = `AI Mix: ${names}`;
            this.el.stopTherapyBtn.style.display = "flex";
            this.el.saveSoundBtn.style.display = "flex";
            this._startSessionTimer();
            this._visualizer.start();
            this._particles.start();
            this._emotionRadar.start();
            if (this.el.emotionRadar) this.el.emotionRadar.style.display = "flex";
            this._visualizer.setMood("calm");
            this._particles.setMood("calm");
            this._emotionRadar.setEmotion("calm");
            if (this.el.wellnessGauge) this.el.wellnessGauge.style.display = "flex";
            layers.forEach(l => {
                if (!this._therapiesUsed.includes(l.type)) this._therapiesUsed.push(l.type);
            });
            this._setScreenTherapy(layers[0]?.type || "mix");
            this._startSoundJourney("mix");
            this._activateChakras(layers[0]?.type || "chakra_tune");
            this._addBubble(`Now playing AI mix: ${names}`, "system");
            this._setMoodBg("calm");
        };

        this.ws.onComposeRaga = (msg) => {
            this.el.moodChips.style.display = "none";
            clearTimeout(this._chipTimeout);
            this._startGenerativeComposition(msg);
        };

        this.ws.onMeditationStart = (style, duration, theme) => {
            this.isMeditationMode = true;
            this._enterMeditationMode(style, duration, theme);
        };
        this.ws.onMeditationEnd = () => {
            this.isMeditationMode = false;
            this._exitMeditationMode();
        };

        this.ws.onSpotifyPlay = (query) => {
            this._showSpotifyBar(query);
            this._addBubble(`Spotify: Playing "${query}"`, "system");
        };
        this.ws.onSpotifyStatus = (action) => {
            if (action === "pause") { this._hideSpotifyBar(); this._addBubble("Spotify paused", "system"); }
            else if (action === "resume") { if (this.el.spotifyBar) this.el.spotifyBar.style.display = "flex"; }
            else if (action === "next") this._addBubble("Spotify: Skipped to next track", "system");
            else if (action === "previous") this._addBubble("Spotify: Previous track", "system");
        };
        this.ws.onSpotifyNowPlaying = (info) => {
            if (info && info.track) this._updateSpotifyBar(info.track, info.artist);
        };

        this.ws.onWellnessScore = (score, indicators) => {
            this._updateWellnessScore(score, indicators);
            if (this._soundJourney) this._soundJourney.addWellnessPoint(score);
        };

        this.ws.onMoodAssessed = (emotion, confidence, facialObs, voiceObs) => {
            this._currentMood = emotion;
            this._setMoodBg(emotion);
            this._addMoodEntry(emotion, confidence);
            this._visualizer.setMood(emotion);
            this._particles.setMood(emotion);
            this._updatePerceptionPanel(facialObs, voiceObs, confidence);
            this._updateBiometrics(emotion);
            if (this._emotionRadar) this._emotionRadar.setEmotion(emotion);
            if (this._soundJourney) this._soundJourney.addMoodMarker(emotion);
        };

        this.ws.onMoodChanged = (fromMood, toMood, trigger, observations) => {
            this._currentMood = toMood;
            this._setMoodBg(toMood);
            this._addMoodEntry(toMood, null, trigger);
            this._visualizer.setMood(toMood);
            this._particles.setMood(toMood);
            if (observations) this._updatePerceptionPanel(observations, null, null);
            this._updateBiometrics(toMood);
            if (this._emotionRadar) this._emotionRadar.setEmotion(toMood);
            if (this._soundJourney) this._soundJourney.addMoodMarker(toMood);
        };

        this.ws.onAffirmation = (text, theme) => { this._showAffirmation(text, theme); };
        this.ws.onSessionInsight = (insight, category) => { this._showSessionInsight(insight, category); };

        this.ws.onTurnComplete = () => {
            this._agentIsSpeaking = false;
            this._setAgentStatus("sensing");
            this._lastOutputBubble = null;
            this._lastInputBubble = null;
            this.therapy.unduck();
            this.generative.unduck();
            this._unduckBgMusic();
        };

        this.ws.onInterrupted = () => {
            this._agentIsSpeaking = false;
            this.audio.stopPlayback();
            this._setAgentStatus("listening");
            this._lastOutputBubble = null;
            this.therapy.duck();
            this._duckBgMusic();
            clearTimeout(this._interruptUnduckTimer);
            this._interruptUnduckTimer = setTimeout(() => {
                this.therapy.unduck();
                this._unduckBgMusic();
            }, 3000);
        };

        this.ws.onStatus = (status, detail) => {
            this._setAgentStatus(status);
            if (detail) {
                if (detail.includes("start_therapy")) this._addBubble("Starting sound therapy...", "system");
                else if (detail.includes("assess_mood")) this._addBubble("Assessing your mood...", "system");
                else this._addBubble(detail, "system");
            }
        };
    }

    _handleVoiceActivity(rms) {
        if (rms > 0.02) this.el.micBtn.classList.add("voice-active");
        else this.el.micBtn.classList.remove("voice-active");

        if (this._heartRate && rms > 0.01) {
            this._voiceRmsHistory.push(rms);
            if (this._voiceRmsHistory.length > 30) this._voiceRmsHistory.shift();
            const mean = this._voiceRmsHistory.reduce((a, b) => a + b, 0) / this._voiceRmsHistory.length;
            const variance = this._voiceRmsHistory.reduce((a, b) => a + (b - mean) ** 2, 0) / this._voiceRmsHistory.length;
            this._heartRate.updateVoiceStress(rms, variance * 100);
        }

        if (this._agentIsSpeaking && !this._interruptCooldown && rms > 0.04) {
            this._agentIsSpeaking = false;
            this.audio.stopPlayback();
            this._setAgentStatus("listening");
            this._lastOutputBubble = null;
            this.therapy.duck();
            this._duckBgMusic();
            clearTimeout(this._interruptUnduckTimer);
            this._interruptUnduckTimer = setTimeout(() => {
                this.therapy.unduck();
                this._unduckBgMusic();
            }, 3000);
            this._interruptCooldown = true;
            setTimeout(() => { this._interruptCooldown = false; }, 1500);
        }
    }

    // --- Onboarding ---

    _showLanguageSelection() {
        if (!this.el.langOverlay) { this._showEnvironmentSelection(); return; }
        this.el.langOverlay.style.display = "flex";
    }

    _onLanguageSelected(lang) {
        this._selectedLanguage = lang;
        if (this.el.langOverlay) this.el.langOverlay.style.display = "none";
        this._showEnvironmentSelection();
    }

    _showEnvironmentSelection() {
        if (!this.el.envOverlay) { this._connectSession(); return; }
        this.el.envOverlay.style.display = "flex";
    }

    _onEnvironmentSelected(env) {
        this._selectedEnvironment = env;
        if (this.el.envOverlay) this.el.envOverlay.style.display = "none";
        this._connectSession();
    }

    // --- Session Management ---

    async startSession() {
        this._endingSession = false;
        this._reconnectAttempts = 0;
        try {
            this.el.startBtn.disabled = true;
            this.el.startBtn.innerHTML = '<span class="material-icons-round">hourglass_top</span> Connecting...';
            await this.audio.init();
            await this.camera.init("camera-video", "camera-canvas");
            this._showScreen("agent");
            this._showLanguageSelection();
        } catch (err) {
            this._showError("Setup Failed", err.message);
            this.el.startBtn.disabled = false;
            this.el.startBtn.innerHTML = '<span class="material-icons-round">self_improvement</span> Begin Your Session';
        }
    }

    async _connectSession() {
        try { await this.ws.connect(); }
        catch (err) { this._showError("Connection Failed", err.message); }
    }

    endSession() {
        this._endingSession = true;
        this._reconnectAttempts = 0;
        const hasReport = this._wellnessScores.length >= 2 || this._moodJourney.length >= 1;
        if (hasReport) this._showSessionReport();

        this.isSessionActive = false;
        this.isMeditationMode = false;
        clearInterval(this._autoCaptureId);
        this._autoCaptureId = null;
        clearTimeout(this._chipTimeout);
        clearTimeout(this._meditationTimer);
        this._stopSessionTimer();
        this.audio.destroy();
        this.camera.destroy();
        this.ws.disconnect();
        this.therapy.stop();
        this._stopBgMusic();
        this._visualizer.stop();
        this._particles.stop();
        this._emotionRadar.stop();
        this._stopBreathingGuide();
        this._deactivateSOS();

        if (this._heartRate) { this._heartRate.stop(); this._heartRate = null; }
        if (this._soundJourney) this._soundJourney.stop();
        clearInterval(this._soundJourneyTimer);
        this._clearScreenTherapy();
        this._deactivateChakras();
        this._hideAffirmation();
        this._stopZenMeditation();
        if (this.el.zenBubble) this.el.zenBubble.style.display = "none";
        if (this.el.mixerBtn) this.el.mixerBtn.style.display = "none";
        this._hideMixer();
        this._voiceRmsHistory = [];
        if (this.el.biometricsBar) this.el.biometricsBar.style.display = "none";
        if (this.el.soundJourney) this.el.soundJourney.style.display = "none";

        this._updateStreak();

        if (this.el.moodJourneyTimeline) this.el.moodJourneyTimeline.innerHTML = "";
        if (this.el.moodJourney) this.el.moodJourney.style.display = "none";
        if (this.el.emotionRadar) this.el.emotionRadar.style.display = "none";
        if (this.el.perceptionPanel) this.el.perceptionPanel.style.display = "none";
        if (this.el.wellnessGauge) this.el.wellnessGauge.style.display = "none";
        if (this.el.therapyScience) this.el.therapyScience.style.display = "none";
        this.el.transcriptContent.innerHTML = "";
        if (this.el.moodChips) this.el.moodChips.style.display = "none";
        this._hideSpotifyBar();
        document.body.classList.remove("meditation-mode");
        this._setMoodBg("neutral");

        this._showScreen("landing");

        this._initialWellnessScore = null;
        this._currentWellnessScore = null;
        this._wellnessScores = [];
        this._therapiesUsed = [];
        this._moodJourney = [];
        this._sessionInsights = [];
        clearTimeout(this._insightTimer);
        if (this.el.insightToast) this.el.insightToast.style.display = "none";

        this.el.startBtn.disabled = false;
        this.el.startBtn.innerHTML = '<span class="material-icons-round">self_improvement</span> Begin Your Session';
        this._endingSession = false;
    }

    toggleCamera() {
        this.isCameraVisible = !this.isCameraVisible;
        const icon = this.el.cameraToggleBtn.querySelector(".material-icons-round");
        if (this.isCameraVisible) {
            this.el.cameraContainer.classList.remove("hidden");
            if (this.el.perceptionPanel && this.el.perceptionPanel.dataset.active === "true")
                this.el.perceptionPanel.style.display = "block";
            icon.textContent = "videocam";
            this.camera.resume();
        } else {
            this.el.cameraContainer.classList.add("hidden");
            if (this.el.perceptionPanel) this.el.perceptionPanel.style.display = "none";
            icon.textContent = "videocam_off";
            this.camera.pause();
        }
    }

    toggleMic() {
        const muted = this.audio.toggleMute();
        const icon = this.el.micBtn.querySelector(".material-icons-round");
        if (muted) {
            this.el.micBtn.classList.remove("active");
            this.el.micBtn.classList.add("muted");
            icon.textContent = "mic_off";
            this.el.micHint.textContent = "Tap to unmute";
        } else {
            this.el.micBtn.classList.remove("muted");
            this.el.micBtn.classList.add("active");
            icon.textContent = "mic";
            this.el.micHint.textContent = "Tap to mute";
        }
    }

    // --- Quick Mood Selection ---

    _onMoodChipSelected(mood) {
        this.el.moodChips.style.display = "none";
        clearTimeout(this._chipTimeout);

        const directPlay = DIRECT_PLAY_MAP[mood];
        if (directPlay) {
            this._startTherapySound(directPlay.therapy);
            this._addBubble(`Quick start: ${directPlay.label}`, "system");
            this.ws.sendText(`I selected "${mood}" and sound therapy is already playing. Please acknowledge briefly and guide me.`);
            setTimeout(() => this._startCameraAnalysis(), 5000);
            return;
        }

        const moodMessages = {
            stressed: "I'm feeling really stressed right now. Please start therapy for stress relief immediately.",
            anxious: "I'm feeling anxious and uneasy. Please help me calm down with therapy right away.",
            sad: "I'm feeling sad and low energy. Please start therapy to help lift my mood.",
            need_focus: "I need to focus and concentrate better. Please start focus therapy.",
            meditation: "I want to meditate. Please guide me through a meditation session with healing sounds.",
            wellness: "I'm feeling okay but want to enhance my general wellness. Please start a healing session.",
        };
        const message = moodMessages[mood] || `I'm feeling ${mood}. Please start appropriate therapy.`;
        this.ws.sendText(message);
        this._addBubble(message, "user");
        setTimeout(() => this._startCameraAnalysis(), 5000);
    }

    _onAnalyzeMoodClicked() {
        this.el.moodChips.style.display = "none";
        clearTimeout(this._chipTimeout);
        this._startCameraAnalysis();
        this.ws.sendText("Please analyze my mood from my face and voice, then recommend the best therapy for me.");
        this._addBubble("Analyzing your mood...", "system");
    }

    _startCameraAnalysis() {
        if (this._autoCaptureId) return;
        if (this.el.perceptionPanel) {
            this.el.perceptionPanel.style.display = "block";
            this.el.perceptionPanel.dataset.active = "true";
        }
        this._autoCaptureId = setInterval(() => {
            if (this.isCameraVisible && this.camera.isActive) {
                const frame = this.camera.captureFrame();
                if (frame) this.ws.sendImage(frame);
            }
        }, 2000);
        this._startHeartRate();
    }

    _startHeartRate() {
        if (this._heartRate) return;
        const video = document.getElementById("camera-video");
        const canvas = document.getElementById("camera-canvas");
        if (!video || !canvas) return;

        this._heartRate = new HeartRateEstimator(video, canvas);
        this._heartRate.onBPMUpdate = (bpm) => {
            if (this.el.heartRateValue) this.el.heartRateValue.textContent = bpm;
            if (this.el.biometricsBar) this.el.biometricsBar.style.display = "flex";
            const icon = document.querySelector(".heartbeat-icon");
            if (icon) icon.style.animationDuration = (60 / bpm) + "s";
            this._hapticPulse();
        };
        this._heartRate.onVoiceStressUpdate = (level) => {
            if (this.el.voiceStressBar) this.el.voiceStressBar.style.width = level + "%";
            if (this.el.voiceStressValue) {
                if (level < 25) this.el.voiceStressValue.textContent = "Low";
                else if (level < 50) this.el.voiceStressValue.textContent = "Mild";
                else if (level < 75) this.el.voiceStressValue.textContent = "High";
                else this.el.voiceStressValue.textContent = "Acute";
            }
        };
        this._heartRate.onCoherenceUpdate = (coherence) => {
            if (this.el.coherenceValue) this.el.coherenceValue.textContent = coherence;
        };
        this._heartRate.start();
    }

    // --- UI Helpers ---

    _setMoodBg(mood) {
        const classes = this.el.moodBg.className.split(" ").filter(c => !c.startsWith("mood-"));
        this.el.moodBg.className = classes.join(" ") + ` mood-${mood}`;
    }

    _startSessionTimer() {
        this._timerStart = Date.now();
        this.el.sessionTimer.style.display = "flex";
        clearInterval(this._timerInterval);
        this._timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this._timerStart) / 1000);
            const min = String(Math.floor(elapsed / 60)).padStart(2, "0");
            const sec = String(elapsed % 60).padStart(2, "0");
            this.el.sessionTimerText.textContent = `${min}:${sec}`;
        }, 1000);
    }

    _stopSessionTimer() {
        clearInterval(this._timerInterval);
        this.el.sessionTimer.style.display = "none";
    }

    _scrollToBottom() {
        requestAnimationFrame(() => {
            const el = this.el.transcriptArea;
            if (!el) return;
            el.scrollTop = el.scrollHeight;
            setTimeout(() => { el.scrollTop = el.scrollHeight; }, 50);
            setTimeout(() => { el.scrollTop = el.scrollHeight; }, 150);
        });
    }

    _showScreen(name) {
        this.el.landingScreen.classList.remove("active");
        this.el.agentScreen.classList.remove("active");
        (name === "landing" ? this.el.landingScreen : this.el.agentScreen).classList.add("active");
    }

    _setStatus(status) {
        this.el.statusDot.className = "status-dot" + (status === "connected" ? " connected" : "");
        this.el.statusText.textContent = status === "connected" ? "Connected" : "Disconnected";
    }

    _setAgentStatus(status) {
        const labels = {
            sensing: "Sensing your mood...", speaking: "Guiding you...",
            thinking: "Preparing therapy...", listening: "Listening to you...",
        };
        this.el.agentStatusText.textContent = labels[status] || "Ready";
    }

    _addBubble(text, type) {
        const bubble = document.createElement("div");
        bubble.className = `transcript-bubble ${type}`;
        bubble.textContent = text;
        this.el.transcriptContent.appendChild(bubble);
        this._scrollToBottom();
        const all = this.el.transcriptContent.querySelectorAll(".transcript-bubble");
        if (all.length > 50) all[0].remove();
        return bubble;
    }

    _showError(title, message) {
        if (this.el.errorTitle) this.el.errorTitle.textContent = title;
        if (this.el.errorMessage) this.el.errorMessage.textContent = message;
        if (this.el.errorModal) this.el.errorModal.style.display = "flex";
        console.error("[Naada] Error:", title, message);
    }
}

// Mix in modular components
Object.assign(NaadaApp.prototype, TherapyController, SessionTracker, UIEffects);

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    window.naada = new NaadaApp();
});
