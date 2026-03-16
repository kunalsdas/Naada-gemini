/**
 * UIEffects — Intro sequence, background music, SOS, breathing, meditation, zen bubble,
 * affirmation cards, haptics, perception panel, biometrics
 * Mixin for NaadaApp prototype.
 */

const UIEffects = {
    // --- Intro Voice ---

    _femaleVoice: null,

    _pickFemaleVoice() {
        if (this._femaleVoice) return this._femaleVoice;
        const voices = window.speechSynthesis.getVoices();
        const femaleNames = [
            "Samantha", "Karen", "Google UK English Female",
            "Zira", "Fiona", "Moira", "Tessa", "Victoria",
            "Google US English"
        ];
        let voice = null;
        for (const name of femaleNames) {
            voice = voices.find(v => v.name.includes(name) && v.lang.startsWith("en"));
            if (voice) break;
        }
        if (!voice) voice = voices.find(v => v.lang.startsWith("en") && v.localService);
        if (!voice) voice = voices.find(v => v.lang.startsWith("en"));
        if (!voice) voice = voices[0];
        this._femaleVoice = voice;
        return voice;
    },

    _speak(text, rate = 1.0, pitch = 1.05) {
        return new Promise(resolve => {
            if (!window.speechSynthesis) { resolve(); return; }
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(text);
            utter.rate = rate;
            utter.pitch = pitch;
            utter.volume = 1;
            const voice = this._pickFemaleVoice();
            if (voice) utter.voice = voice;
            let resolved = false;
            const done = () => { if (!resolved) { resolved = true; resolve(); } };
            utter.onend = done;
            utter.onerror = done;
            window.speechSynthesis.speak(utter);
            setTimeout(done, 4000);
        });
    },

    _wait(ms) { return new Promise(r => setTimeout(r, ms)); },

    // --- Cinematic Intro ---

    async _playIntroSequence() {
        const line1 = document.querySelector(".intro-line-1");
        const line2 = document.querySelector(".intro-line-2");
        const line3 = document.querySelector(".intro-line-3");
        const line4 = document.querySelector(".intro-line-4");
        const line5 = document.querySelector(".intro-line-5");
        const buttons = document.getElementById("intro-buttons");
        if (!line1) return;

        // Safety net: always show buttons after 8 seconds even if intro fails
        const safetyTimer = setTimeout(() => {
            if (buttons && !buttons.classList.contains("visible")) {
                buttons.classList.add("visible");
                if (this.el.conditionSelector) this.el.conditionSelector.style.display = "block";
            }
        }, 8000);

        if (window.speechSynthesis) {
            window.speechSynthesis.getVoices();
            await this._wait(200);
            window.speechSynthesis.getVoices();
            await this._wait(100);
        }

        const fadeIn = (el) => { el.classList.remove("hidden"); void el.offsetWidth; el.classList.add("visible"); };
        const fadeOut = (el) => { el.classList.remove("visible"); el.classList.add("hidden"); };

        await this._wait(500);
        fadeIn(line1);
        await this._speak("Hey there!", 1.0, 1.08);
        await this._wait(250);
        fadeOut(line1);
        await this._wait(400);

        fadeIn(line2);
        await this._wait(120);
        fadeIn(line3);
        await this._speak("Welcome to, Naada", 0.95, 1.05);
        await this._wait(350);
        fadeOut(line2);
        fadeOut(line3);
        await this._wait(400);

        await this._wait(350);

        fadeIn(line4);
        await this._speak("AI Sound Therapy", 0.92, 1.1);
        await this._wait(300);
        fadeOut(line4);
        await this._wait(400);

        fadeIn(line5);
        await this._speak("Powered by Gemini", 0.95, 1.08);

        await this._wait(250);
        clearTimeout(safetyTimer);
        if (buttons) buttons.classList.add("visible");
        await this._wait(600);
        if (this.el.conditionSelector) this.el.conditionSelector.style.display = "block";
    },

    // --- Background Tibetan Bowl Music ---

    _startBgMusicOnInteraction() {
        const start = () => {
            if (this._bgMusicStarted) return;
            this._bgMusicStarted = true;
            this._playBgMusic();
            document.removeEventListener("click", start);
            document.removeEventListener("touchstart", start);
        };
        document.addEventListener("click", start, { once: false });
        document.addEventListener("touchstart", start, { once: false });
    },

    async _playBgMusic() {
        try {
            this.therapy.init();
            if (this.therapy.ctx.state === "suspended") await this.therapy.ctx.resume();
            this._bgGain = this.therapy.ctx.createGain();
            this._bgGain.gain.value = 0;
            this._bgGain.connect(this.therapy.ctx.destination);
            // Also connect to analyser so visualizer reacts to bg music
            if (this.therapy.analyser) this._bgGain.connect(this.therapy.analyser);

            const buffer = await this.therapy._loadAudio("tibetan-bowls.mp3");
            const source = this.therapy.ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.connect(this._bgGain);
            source.start(0);
            this._bgSource = source;
            this._bgGain.gain.setTargetAtTime(0.5, this.therapy.ctx.currentTime, 1.5);
        } catch (e) {
            console.warn("[Naada] Background music error:", e);
        }
    },

    _stopBgMusic() {
        if (this._bgSource) {
            try {
                this._bgGain.gain.setTargetAtTime(0, this.therapy.ctx.currentTime, 0.5);
                setTimeout(() => {
                    try { this._bgSource.stop(); } catch(e) {}
                    try { this._bgSource.disconnect(); } catch(e) {}
                    this._bgSource = null;
                }, 1500);
            } catch (e) {}
        }
    },

    _duckBgMusic() {
        if (this._bgGain && this.therapy.ctx) {
            this._bgGain.gain.setTargetAtTime(0.15, this.therapy.ctx.currentTime, 0.3);
        }
    },

    _unduckBgMusic() {
        if (this._bgGain && this.therapy.ctx) {
            this._bgGain.gain.setTargetAtTime(0.5, this.therapy.ctx.currentTime, 0.5);
        }
    },

    // --- Meditation Mode ---

    _enterMeditationMode(style, duration, theme) {
        this.therapy.setVolume(0.5);
        document.body.classList.add("meditation-mode");
        this.el.therapyIcon.textContent = "self_improvement";
        const styleLabels = {
            breathing: "Breathing Exercise", body_scan: "Body Scan",
            visualization: "Guided Visualization", loving_kindness: "Loving Kindness",
            mantra: "Mantra Meditation",
        };
        this._addBubble(`Meditation: ${styleLabels[style] || style} (${duration} min)`, "system");
        if (style === "breathing") this._startBreathingGuide(duration);
        this._meditationTimer = setTimeout(() => {
            this.ws.sendText("The meditation time is complete. Please gently bring the session to a close.");
        }, duration * 60 * 1000);
    },

    _exitMeditationMode() {
        this.therapy.setVolume(0.3);
        document.body.classList.remove("meditation-mode");
        clearTimeout(this._meditationTimer);
        this._stopBreathingGuide();
        this._addBubble("Meditation session complete. Namaste.", "system");
    },

    // --- Breathing Guide ---

    _startBreathingGuide(durationMinutes, customPhases) {
        if (!this.el.breathingGuide) return;
        this.el.breathingGuide.style.display = "flex";

        const phases = customPhases || [
            { label: "Breathe In", duration: 4 },
            { label: "Hold", duration: 4 },
            { label: "Breathe Out", duration: 4 },
            { label: "Hold", duration: 4 },
        ];
        const activePhases = phases.filter(p => p.duration > 0);
        let phaseIdx = 0;
        let countdown = activePhases[0].duration;

        const update = () => {
            this.el.breathingLabel.textContent = activePhases[phaseIdx].label;
            this.el.breathingCount.textContent = countdown;
        };
        update();

        this._breathingInterval = setInterval(() => {
            countdown--;
            if (countdown <= 0) {
                phaseIdx = (phaseIdx + 1) % activePhases.length;
                countdown = activePhases[phaseIdx].duration;
                const label = activePhases[phaseIdx].label.toLowerCase();
                if (label.includes("in")) this._hapticBreathe("in");
            }
            update();
        }, 1000);

        this._breathingAutoStop = setTimeout(() => {
            this._stopBreathingGuide();
        }, durationMinutes * 60 * 1000);
    },

    _stopBreathingGuide() {
        if (this._breathingInterval) {
            clearInterval(this._breathingInterval);
            this._breathingInterval = null;
        }
        clearTimeout(this._breathingAutoStop);
        if (this.el.breathingGuide) this.el.breathingGuide.style.display = "none";
    },

    // --- SOS Emergency Calm ---

    _activateSOS() {
        if (this._sosActive) { this._deactivateSOS(); return; }
        this._sosActive = true;

        if (this.el.sosBtn) this.el.sosBtn.classList.add("sos-active");
        this.therapy.playMix([
            { type: "nature_rain", volume: 0.6 },
            { type: "delta_waves", volume: 0.4 },
        ], 0.5).catch(e => console.warn("[Naada] SOS mix error:", e));

        this.el.therapyIndicator.classList.add("active");
        this.el.therapyIcon.textContent = "healing";
        this.el.therapyLabel.style.display = "flex";
        this.el.therapyLabelText.textContent = "Emergency Calm Protocol";
        this.el.stopTherapyBtn.style.display = "flex";
        this._startSessionTimer();
        this._visualizer.start();
        this._particles.start();
        this._setMoodBg("calm");

        this._startBreathingGuide(10, [
            { label: "Breathe In", duration: 4 },
            { label: "Hold", duration: 7 },
            { label: "Breathe Out", duration: 8 },
        ]);

        if (this.el.groundingOverlay) this.el.groundingOverlay.style.display = "flex";

        if (this.ws.isConnected) {
            this.ws.sendText("User activated SOS calm mode. They may be experiencing a panic attack or severe anxiety. Switch to emergency calming protocol. Speak very slowly and gently. Guide them through deep breathing and grounding. Reassure them they are safe.");
        }

        this._setScreenTherapy("sos");
        this._startSoundJourney("sos");
        this._hapticSOS();
        this._addBubble("SOS Calm activated — breathe with the guide", "system");
    },

    _deactivateSOS() {
        if (!this._sosActive) return;
        this._sosActive = false;
        if (this.el.sosBtn) this.el.sosBtn.classList.remove("sos-active");
        if (this.el.groundingOverlay) this.el.groundingOverlay.style.display = "none";
        this._stopBreathingGuide();
        // Stop SOS therapy sounds
        if (this.therapy) this.therapy.stop();
    },

    // --- Zen Bubble & Micro-Meditation ---

    _startZenMeditation() {
        if (!this.el.zenOverlay) return;
        this.el.zenOverlay.style.display = "flex";
        if (this.el.zenBubble) this.el.zenBubble.style.display = "none";

        this._zenTimeLeft = 30;
        this._zenPhase = "in";
        this._zenPhaseTime = 4;
        this._zenPhaseCounter = 0;

        if (this.el.zenBreathLabel) this.el.zenBreathLabel.textContent = "Breathe In";
        if (this.el.zenBreathTimer) this.el.zenBreathTimer.textContent = "0:30";
        if (this.el.zenBreathCircle) this.el.zenBreathCircle.classList.add("inhale");

        this._zenInterval = setInterval(() => {
            this._zenTimeLeft--;
            this._zenPhaseCounter++;

            if (this.el.zenBreathTimer) {
                const mins = Math.floor(this._zenTimeLeft / 60);
                const secs = this._zenTimeLeft % 60;
                this.el.zenBreathTimer.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
            }

            if (this._zenPhaseCounter >= this._zenPhaseTime) {
                this._zenPhaseCounter = 0;
                if (this._zenPhase === "in") {
                    this._zenPhase = "hold";
                    this._zenPhaseTime = 4;
                    if (this.el.zenBreathLabel) this.el.zenBreathLabel.textContent = "Hold";
                    if (this.el.zenBreathCircle) {
                        this.el.zenBreathCircle.classList.remove("inhale", "exhale");
                        this.el.zenBreathCircle.classList.add("hold");
                    }
                } else if (this._zenPhase === "hold") {
                    this._zenPhase = "out";
                    this._zenPhaseTime = 4;
                    if (this.el.zenBreathLabel) this.el.zenBreathLabel.textContent = "Breathe Out";
                    if (this.el.zenBreathCircle) {
                        this.el.zenBreathCircle.classList.remove("inhale", "hold");
                        this.el.zenBreathCircle.classList.add("exhale");
                    }
                } else {
                    this._zenPhase = "in";
                    this._zenPhaseTime = 4;
                    if (this.el.zenBreathLabel) this.el.zenBreathLabel.textContent = "Breathe In";
                    if (this.el.zenBreathCircle) {
                        this.el.zenBreathCircle.classList.remove("exhale", "hold");
                        this.el.zenBreathCircle.classList.add("inhale");
                    }
                }
            }

            if (this._zenTimeLeft <= 0) {
                this._stopZenMeditation();
                this._addBubble("Zen moment complete. Feel refreshed!", "system");
            }
        }, 1000);

        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
    },

    _stopZenMeditation() {
        clearInterval(this._zenInterval);
        this._zenInterval = null;
        if (this.el.zenOverlay) this.el.zenOverlay.style.display = "none";
        if (this.el.zenBreathCircle) this.el.zenBreathCircle.classList.remove("inhale", "hold", "exhale");
        if (this.isSessionActive && this.el.zenBubble) this.el.zenBubble.style.display = "block";
    },

    // --- AI Affirmation Cards ---

    _showAffirmation(text, theme = "calm") {
        if (!this.el.affirmationCard || !this.el.affirmationText) return;
        clearTimeout(this._affirmationTimer);
        this.el.affirmationCard.classList.remove("fade-out");
        this.el.affirmationCard.className = `affirmation-card theme-${theme}`;
        this.el.affirmationText.innerHTML = "";
        this.el.affirmationCard.style.display = "block";

        let i = 0;
        const cursor = document.createElement("span");
        cursor.className = "typewriter-cursor";
        this.el.affirmationText.appendChild(cursor);

        const typeInterval = setInterval(() => {
            if (i < text.length) {
                cursor.before(text[i]);
                i++;
            } else {
                clearInterval(typeInterval);
                setTimeout(() => { cursor.remove(); }, 1500);
            }
        }, 40);

        this._affirmationTimer = setTimeout(() => { this._hideAffirmation(); }, 8000);
    },

    _hideAffirmation() {
        if (!this.el.affirmationCard) return;
        this.el.affirmationCard.classList.add("fade-out");
        clearTimeout(this._affirmationTimer);
        setTimeout(() => {
            if (this.el.affirmationCard) this.el.affirmationCard.style.display = "none";
        }, 600);
    },

    // --- Haptic Feedback ---

    _hapticPulse() {
        if (!navigator.vibrate) return;
        try { navigator.vibrate(20); } catch (e) {}
    },

    _hapticSOS() {
        if (!navigator.vibrate) return;
        try { navigator.vibrate([200, 100, 200, 100, 400]); } catch (e) {}
    },

    _hapticBreathe(phase) {
        if (!navigator.vibrate) return;
        if (phase === "in") { try { navigator.vibrate(100); } catch (e) {} }
    },

    // --- AI Perception Panel ---

    _updatePerceptionPanel(facialObs, voiceObs, confidence) {
        if (!this.el.perceptionPanel) return;

        if (facialObs && this.el.facialTags) {
            const tags = facialObs.split(",").map(t => t.trim()).filter(Boolean);
            this.el.facialTags.innerHTML = tags.length > 0
                ? tags.map(t => `<span class="perception-tag">${t}</span>`).join("")
                : '<span class="perception-tag waiting">No observations</span>';
        }

        if (voiceObs && this.el.voiceTags) {
            const tags = voiceObs.split(",").map(t => t.trim()).filter(Boolean);
            this.el.voiceTags.innerHTML = tags.length > 0
                ? tags.map(t => `<span class="perception-tag">${t}</span>`).join("")
                : '<span class="perception-tag waiting">No observations</span>';
        }

        if (confidence) {
            const confMap = { high: 92, medium: 65, low: 35 };
            const confPercent = typeof confidence === "number"
                ? Math.round(confidence * 100)
                : (confMap[confidence] || 50);
            if (this.el.confidenceBar) this.el.confidenceBar.style.width = confPercent + "%";
            if (this.el.confidenceValue) this.el.confidenceValue.textContent = confPercent + "%";
        }

        if (this.el.perceptionPulse) {
            this.el.perceptionPulse.style.animation = "none";
            void this.el.perceptionPulse.offsetWidth;
            this.el.perceptionPulse.style.animation = "perceptionPulse 2s ease-in-out infinite";
        }
    },

    _updateBiometrics(emotion) {
        const stressMap = {
            stressed: 90, anxious: 80, angry: 85, tired: 55,
            sad: 45, neutral: 30, focused: 20, calm: 10,
            relaxed: 8, happy: 12, peaceful: 5,
        };
        const stressLevel = stressMap[emotion] || 30;
        const relaxLevel = 100 - stressLevel;
        if (this.el.stressMeter) this.el.stressMeter.style.width = stressLevel + "%";
        if (this.el.relaxMeter) this.el.relaxMeter.style.width = relaxLevel + "%";
    },
};
