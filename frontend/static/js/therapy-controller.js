/**
 * TherapyController — Manages therapy playback, generative composition, mixer, DAF, neurotone, frequency matrix
 * Extracted from NaadaApp for modular architecture.
 */

const TherapyController = {
    _startTherapySound(type) {
        this._stopBgMusic();
        if (this._selectedCondition === "stuttering" || type === "stutter_daf") {
            if (this.el.dafPanel) this.el.dafPanel.style.display = "block";
        }

        const env = this._selectedEnvironment || "home";
        this.therapy.playProcessed(type, 0.3, env).catch(e =>
            console.warn("[Naada] Therapy play error:", e)
        );

        this.el.therapyIndicator.classList.add("active");
        this.el.therapyIcon.textContent = "music_note";
        this.el.therapyLabel.style.display = "flex";
        this.el.therapyLabelText.textContent = THERAPY_LABELS[type] || type;
        this.el.stopTherapyBtn.style.display = "flex";
        this.el.saveSoundBtn.style.display = "flex";
        this._startSessionTimer();

        this._visualizer.start();
        this._particles.start();
        this._emotionRadar.start();
        if (this.el.emotionRadar) this.el.emotionRadar.style.display = "flex";
        if (!this._therapiesUsed.includes(type)) this._therapiesUsed.push(type);
        this._showTherapyScience(type);
        if (this.el.wellnessGauge) this.el.wellnessGauge.style.display = "flex";
        this._setScreenTherapy(type);
        this._startSoundJourney(type);
        this._activateChakras(type);
        if (this.el.mixerBtn) this.el.mixerBtn.style.display = "flex";
        this._addBubble(`Now playing: ${THERAPY_LABELS[type] || type}`, "system");

        const mood = THERAPY_MOOD_MAP[type] || "calm";
        this._setMoodBg(mood);
        this._visualizer.setMood(mood);
        this._particles.setMood(mood);
    },

    _startGenerativeComposition(params) {
        this._stopBgMusic();
        this.therapy.stop();

        const ragaNames = {
            bhairav: "Raga Bhairav", yaman: "Raga Yaman", malkauns: "Raga Malkauns",
            darbari: "Raga Darbari Kanada", bageshree: "Raga Bageshree", todi: "Raga Todi",
            durga: "Raga Durga", bhoopali: "Raga Bhoopali", auto: "Auto-Selected Raga",
        };
        const instrNames = {
            sitar: "Sitar", bansuri: "Bansuri Flute", harp: "Harp",
            veena: "Veena", recitation: "Recitation Mode",
        };

        const ragaLabel = ragaNames[params.raga] || params.raga;
        const instrLabel = instrNames[params.instrument] || params.instrument;

        if (params.instrument === 'recitation') {
            this.generative.startRecitationMode({ mood: params.mood || 'spiritual', volume: 0.12 });
        } else {
            this.generative.compose({
                raga: params.raga === 'auto' ? undefined : params.raga,
                instrument: params.instrument,
                tempo: params.tempo || 60,
                withTabla: params.with_tabla,
                withTanpura: params.with_tanpura,
                mood: params.mood || 'calm',
                volume: 0.25,
            });
        }

        this.el.therapyIndicator.classList.add("active");
        this.el.therapyIcon.textContent = "auto_awesome";
        this.el.therapyLabel.style.display = "flex";
        const label = params.instrument === 'recitation'
            ? `Live Recitation — ${ragaLabel}`
            : `Live ${instrLabel} — ${ragaLabel}`;
        this.el.therapyLabelText.textContent = label;
        this.el.stopTherapyBtn.style.display = "flex";
        this.el.saveSoundBtn.style.display = "flex";
        this._startSessionTimer();

        this._visualizer.start();
        this._particles.start();
        this._emotionRadar.start();
        if (this.el.emotionRadar) this.el.emotionRadar.style.display = "flex";
        if (this.el.wellnessGauge) this.el.wellnessGauge.style.display = "flex";
        if (!this._therapiesUsed.includes('generative_raga')) this._therapiesUsed.push('generative_raga');

        const moodBg = { stressed: "calm", anxious: "calm", sad: "peaceful", calm: "calm",
            peaceful: "peaceful", meditative: "peaceful", healing: "relaxed",
            focused: "focused", joyful: "happy" };
        const bg = moodBg[params.mood] || "calm";
        this._setMoodBg(bg);
        this._visualizer.setMood(bg);
        this._particles.setMood(bg);
        this._setScreenTherapy("generative");
        this._addBubble(`Now composing: ${label} — every note is unique, generated live`, "system");
    },

    stopTherapy() {
        if (this.therapy.isRecording) this.therapy.stopRecordingAndDownload();
        this.therapy.stop();
        this.generative.stop();
        this._visualizer.stop();
        this._particles.stop();
        this._emotionRadar.stop();
        if (this.el.emotionRadar) this.el.emotionRadar.style.display = "none";
        this.el.therapyIndicator.classList.remove("active");
        this.el.therapyIcon.textContent = "self_improvement";
        this.el.therapyLabel.style.display = "none";
        this.el.stopTherapyBtn.style.display = "none";
        this.el.saveSoundBtn.style.display = "none";
        if (this.el.therapyScience) this.el.therapyScience.style.display = "none";
        if (this.el.mixerBtn) this.el.mixerBtn.style.display = "none";
        if (this.el.dafPanel) this.el.dafPanel.style.display = "none";
        if (this.therapy.isDafActive) {
            this.therapy.stopDAF();
            if (this.el.dafToggleBtn) this.el.dafToggleBtn.classList.remove("active");
            if (this.el.dafToggleLabel) this.el.dafToggleLabel.textContent = "Activate DAF";
        }
        this._hideMixer();
        this._deactivateChakras();
        this._clearScreenTherapy();
        if (this._soundJourney) this._soundJourney.endTherapy();
        this._stopSessionTimer();
        this._addBubble("Sound therapy stopped", "system");
    },

    async toggleSaveSound() {
        if (this.therapy.isRecording) {
            await this.therapy.stopRecordingAndDownload();
            this.el.saveSoundBtn.querySelector(".material-icons-round").textContent = "save_alt";
            this.el.saveSoundBtn.classList.remove("recording");
            this._addBubble("Sound saved to your device!", "system");
        } else {
            const started = this.therapy.startRecording();
            if (started) {
                this.el.saveSoundBtn.querySelector(".material-icons-round").textContent = "stop";
                this.el.saveSoundBtn.classList.add("recording");
                this._addBubble("Recording... Tap save again to stop and download.", "system");
            }
        }
    },

    _showTherapyScience(therapyType) {
        const info = THERAPY_SCIENCE[therapyType];
        if (!info || !this.el.therapyScience) return;
        this.el.scienceHz.textContent = info.hz;
        this.el.scienceName.textContent = info.name;
        this.el.scienceDesc.textContent = info.desc;
        this.el.scienceEvidence.textContent = info.evidence;
        this.el.therapyScience.style.display = "flex";
    },

    // --- Screen Therapy Ambient ---

    _setScreenTherapy(therapyType) {
        if (!this.el.screenTherapy) return;
        this.el.screenTherapy.className = "screen-therapy-overlay";
        this.el.screenTherapy.classList.add(`therapy-${therapyType}`);
        this.el.screenTherapy.classList.add("active");
    },

    _clearScreenTherapy() {
        if (!this.el.screenTherapy) return;
        this.el.screenTherapy.classList.remove("active");
        setTimeout(() => {
            if (this.el.screenTherapy) this.el.screenTherapy.className = "screen-therapy-overlay";
        }, 3000);
    },

    // --- Sound Journey ---

    _startSoundJourney(therapyType) {
        if (!this._soundJourney || !this.el.soundJourney) return;
        this.el.soundJourney.style.display = "block";
        if (!this._soundJourney._running) {
            this._soundJourney.start();
            this._soundJourneyTimer = setInterval(() => {
                if (this.el.soundJourneyElapsed && this._soundJourney)
                    this.el.soundJourneyElapsed.textContent = this._soundJourney.getElapsedStr();
            }, 1000);
        }
        this._soundJourney.addTherapy(therapyType);
    },

    // --- Chakra Energy Map ---

    _activateChakras(therapyType) {
        if (!this.el.chakraMap) return;
        const activeChakras = CHAKRA_MAP[therapyType] || ["heart"];
        document.querySelectorAll(".chakra-point").forEach(p => p.classList.remove("active"));
        document.querySelectorAll(".chakra-label").forEach(l => l.classList.remove("active"));
        activeChakras.forEach(name => {
            const point = document.getElementById(`chakra-${name}`);
            const label = document.getElementById(`chakra-label-${name}`);
            if (point) point.classList.add("active");
            if (label) label.classList.add("active");
        });
        this.el.chakraMap.style.display = "block";
    },

    _deactivateChakras() {
        if (!this.el.chakraMap) return;
        document.querySelectorAll(".chakra-point").forEach(p => p.classList.remove("active"));
        document.querySelectorAll(".chakra-label").forEach(l => l.classList.remove("active"));
        this.el.chakraMap.style.display = "none";
    },

    // --- Sound Mixer ---

    _showMixer() { if (this.el.mixerPad) this.el.mixerPad.style.display = "flex"; },
    _hideMixer() { if (this.el.mixerPad) this.el.mixerPad.style.display = "none"; },

    _toggleMixerTile(tile) {
        tile.classList.toggle("active");
        const activeTiles = this.el.mixerGrid.querySelectorAll(".mixer-tile.active");
        if (this.el.mixerPlayBtn) {
            this.el.mixerPlayBtn.disabled = activeTiles.length === 0;
            this.el.mixerPlayBtn.innerHTML = activeTiles.length > 0
                ? `<span class="material-icons-round">play_arrow</span> Mix & Play (${activeTiles.length})`
                : `<span class="material-icons-round">play_arrow</span> Mix & Play`;
        }
    },

    _playMixerSelection() {
        const activeTiles = this.el.mixerGrid.querySelectorAll(".mixer-tile.active");
        if (activeTiles.length === 0) return;

        const sounds = [];
        activeTiles.forEach(tile => {
            sounds.push({ type: tile.dataset.sound, volume: 1 / activeTiles.length });
        });

        this._stopBgMusic();
        this.therapy.init();
        this.therapy.playMix(sounds).catch(e => console.warn("[Naada] Mixer play error:", e));

        this.el.therapyIndicator.classList.add("active");
        this.el.therapyLabel.style.display = "flex";
        this.el.therapyLabelText.textContent = `Custom Mix (${activeTiles.length} sounds)`;
        this.el.stopTherapyBtn.style.display = "flex";
        this.el.saveSoundBtn.style.display = "flex";
        this._startSessionTimer();
        this._visualizer.start();
        this._particles.start();

        activeTiles.forEach(tile => {
            if (!this._therapiesUsed.includes(tile.dataset.sound)) this._therapiesUsed.push(tile.dataset.sound);
        });

        this._hideMixer();
        this._addBubble(`Custom mix playing: ${activeTiles.length} sounds blended`, "system");

        if (this.ws && this.ws.isConnected) {
            const names = Array.from(activeTiles).map(t => t.querySelector(".mixer-tile-name").textContent);
            this.ws.sendText(`[SYSTEM] User created custom sound mix: ${names.join(" + ")}. Comment on their selection.`);
        }
    },

    // --- DAF (Delayed Auditory Feedback) ---

    async _toggleDAF() {
        if (!this.therapy.isDafActive) {
            if (this.el.dafToggleBtn) {
                this.el.dafToggleBtn.classList.add("active");
                this.el.dafToggleLabel.textContent = "Activating...";
            }
            const delayMs = this.el.dafDelaySlider ? parseInt(this.el.dafDelaySlider.value) : 150;
            const ok = await this.therapy.startDAF(delayMs / 1000);
            if (ok) {
                if (this.el.dafToggleLabel) this.el.dafToggleLabel.textContent = "DAF Active";
                this._addBubble("DAF activated — speak naturally and notice the difference.", "system");
            } else {
                if (this.el.dafToggleBtn) this.el.dafToggleBtn.classList.remove("active");
                if (this.el.dafToggleLabel) this.el.dafToggleLabel.textContent = "Activate DAF";
                this._addBubble("Mic permission needed for DAF therapy.", "system");
            }
        } else {
            this.therapy.stopDAF();
            if (this.el.dafToggleBtn) this.el.dafToggleBtn.classList.remove("active");
            if (this.el.dafToggleLabel) this.el.dafToggleLabel.textContent = "Activate DAF";
        }
    },

    // --- Neurotone Analysis ---

    _openNeurotoneOverlay() {
        if (!this.el.neurotonesOverlay) return;
        if (this.el.neurotonesScanning) this.el.neurotonesScanning.style.display = "block";
        if (this.el.neurotonesResult) this.el.neurotonesResult.style.display = "none";
        if (this.el.neurotonesProgressFill) this.el.neurotonesProgressFill.style.width = "0%";
        this.el.neurotonesOverlay.style.display = "flex";
        this._runNeurotoneAnalysis();
    },

    async _runNeurotoneAnalysis() {
        const profile = await this.therapy.analyzeNeurotone((progress) => {
            if (this.el.neurotonesProgressFill) this.el.neurotonesProgressFill.style.width = (progress * 100) + "%";
        });
        this._neurotonesProfile = profile;
        if (!profile) {
            this._addBubble("Neurotone analysis needs microphone access.", "system");
            if (this.el.neurotonesOverlay) this.el.neurotonesOverlay.style.display = "none";
            return;
        }
        this._showNeurotoneResult(profile);
    },

    _showNeurotoneResult(profile) {
        if (this.el.neurotonesScanning) this.el.neurotonesScanning.style.display = "none";
        if (this.el.neurotonesResult) this.el.neurotonesResult.style.display = "block";
        if (this.el.neurotonesFreqNumber) this.el.neurotonesFreqNumber.textContent = profile.fundamental;
        if (this.el.neurotonesVoiceType) this.el.neurotonesVoiceType.textContent = profile.voiceIcon + " " + profile.voiceType;
        if (this.el.neurotonesResonanceFill) setTimeout(() => { this.el.neurotonesResonanceFill.style.width = profile.resonanceScore + "%"; }, 100);
        if (this.el.neurotonesResonancePct) this.el.neurotonesResonancePct.textContent = profile.resonanceScore + "%";
        if (this.el.neurotoneseSolfeggioHz) this.el.neurotoneseSolfeggioHz.textContent = profile.nearestSolfeggio;
        if (this.el.neurotoneseSolfeggioName) this.el.neurotoneseSolfeggioName.textContent = profile.solfeggioName;
        if (this.el.neurotoneBrainwave) this.el.neurotoneBrainwave.textContent = profile.brainwaveHint;
        if (this.el.solfNeurotoneMarker) this.el.solfNeurotoneMarker.style.display = "flex";
        if (this.el.solfUserHz) this.el.solfUserHz.textContent = profile.fundamental;
        document.querySelectorAll(".solf-row").forEach(row => {
            row.classList.remove("active-solf");
            if (parseInt(row.dataset.hz) === profile.nearestSolfeggio) row.classList.add("active-solf");
        });
    },

    _closeNeurotoneOverlay() {
        if (this.el.neurotonesOverlay) this.el.neurotonesOverlay.style.display = "none";
    },

    _playNeurotoneTherapy() {
        if (!this._neurotonesProfile) return;
        const type = this._neurotonesProfile.recommendedTherapy;
        this._closeNeurotoneOverlay();
        this._startTherapySound(type);
        this._addBubble(`Playing ${type.replace(/_/g, " ")} — tuned to your ${this._neurotonesProfile.fundamental} Hz voice frequency.`, "system");
        this.ws.sendText(`User's neurotone analysis complete. Fundamental frequency: ${this._neurotonesProfile.fundamental} Hz (${this._neurotonesProfile.voiceType}). Nearest solfeggio: ${this._neurotonesProfile.nearestSolfeggio} Hz (${this._neurotonesProfile.solfeggioName}). Playing personalized therapy: ${type}.`);
    },

    // --- Frequency Matrix Panel ---

    _openFreqMatrix() {
        if (!this.el.freqMatrixOverlay) return;
        this.el.freqMatrixOverlay.style.display = "flex";
        this._freqMatrixOpen = true;
        this._updateFreqMatrixTherapyInfo();
        this._startFreqMatrixLoop();
    },

    _closeFreqMatrix() {
        if (this.el.freqMatrixOverlay) this.el.freqMatrixOverlay.style.display = "none";
        this._freqMatrixOpen = false;
        if (this._freqMatrixRAF) { cancelAnimationFrame(this._freqMatrixRAF); this._freqMatrixRAF = null; }
    },

    _updateFreqMatrixTherapyInfo() {
        const type = this.therapy.currentTherapy;
        const data = type ? THERAPY_FREQ_DATA[type] : null;
        const zone = type ? BRAINWAVE_ZONES[type] : null;

        if (this.el.fmfTherapy) this.el.fmfTherapy.textContent = (type && THERAPY_LABELS[type]) || "—";
        if (this.el.fmfTargetHz) this.el.fmfTargetHz.textContent = data ? data.hz : "—";
        if (this.el.fmfBrainwave) this.el.fmfBrainwave.textContent = data ? data.brainwave : "—";
        if (this.el.fmfEffect) this.el.fmfEffect.textContent = data ? data.effect : "—";

        document.querySelectorAll(".bw-zone").forEach(el => {
            el.classList.remove("active-zone");
            if (zone && el.dataset.zone === zone) el.classList.add("active-zone");
        });

        if (this.el.bwTherapyText) {
            this.el.bwTherapyText.textContent = type ? (THERAPY_LABELS[type] || type) + " → " + (data ? data.brainwave : "—") : "No therapy active";
        }

        const solfeggioTypes = { solfeggio: 528, tibetan_bowls: 396, chronic_pain_delta: 174,
            om_drone: 528, chakra_tune: 396, ptsd_theta: 432 };
        const activeHz = solfeggioTypes[type];
        document.querySelectorAll(".solf-row").forEach(row => {
            row.classList.remove("active-solf");
            if (activeHz && parseInt(row.dataset.hz) === activeHz) row.classList.add("active-solf");
        });
    },

    _startFreqMatrixLoop() {
        if (!this.el.freqMatrixCanvas || !this._freqMatrixOpen) return;
        const canvas = this.el.freqMatrixCanvas;
        const ctx = canvas.getContext("2d");

        const draw = () => {
            if (!this._freqMatrixOpen) return;
            this._freqMatrixRAF = requestAnimationFrame(draw);

            const W = canvas.offsetWidth;
            const H = canvas.offsetHeight;
            if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
            if (W === 0 || H === 0) return;

            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = "rgba(5,3,20,0.97)";
            ctx.fillRect(0, 0, W, H);

            const freqData = this.therapy.getFrequencyData();
            const barCount = 64;
            const barW = (W - 20) / barCount;

            if (freqData && freqData.length > 0) {
                const step = Math.floor(freqData.length / barCount);
                for (let i = 0; i < barCount; i++) {
                    let sum = 0;
                    for (let j = 0; j < step; j++) sum += freqData[i * step + j];
                    const avg = sum / step;
                    const barH = (avg / 255) * (H - 20);
                    const hue = 180 + (i / barCount) * 120;
                    ctx.fillStyle = `hsla(${hue},80%,60%,0.85)`;
                    ctx.fillRect(10 + i * barW, H - barH - 4, barW - 1, barH);
                }
            } else {
                const t = Date.now() / 1000;
                for (let i = 0; i < barCount; i++) {
                    const wave = (Math.sin(i * 0.3 + t * 2) + Math.sin(i * 0.1 + t)) * 0.5;
                    const barH = (wave * 0.15 + 0.15) * (H - 20);
                    const hue = 180 + (i / barCount) * 120;
                    ctx.fillStyle = `hsla(${hue},50%,45%,0.4)`;
                    ctx.fillRect(10 + i * barW, H - barH - 4, barW - 1, barH);
                }
            }

            this._updateFreqMatrixTherapyInfo();
        };
        draw();
    },

    // --- Condition Selector ---

    _onConditionSelected(chip) {
        document.querySelectorAll(".condition-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        this._selectedCondition = chip.dataset.condition || null;
    },
};
