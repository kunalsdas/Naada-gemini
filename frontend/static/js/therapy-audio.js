/**
 * TherapyAudioEngine v3 — File-based and synthesized therapy audio with
 * Web Audio API mixing, environment processing, DAF, and neurotone analysis.
 */
class TherapyAudioEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.activeNodes = [];
        this.isPlaying = false;
        this.currentTherapy = null;
        this._fadeInterval = null;
        this._stopTimeout = null;
        this._targetVolume = 0.3;
        this._bufferCache = {};
        this._loading = {};
        this.AUDIO_BASE = "/static/audio/";

        this.SOUND_MAP = {
            tibetan_bowls:    [{ file: "tibetan-bowls.mp3", gain: 1.0, pan: 0, loop: true }],
            indian_raga:      [{ file: "indian-raga.mp3", gain: 1.0, pan: 0, loop: true }],
            delta_waves:      [{ file: "delta-waves.mp3", gain: 1.0, pan: 0, loop: true }],
            binaural_focus:   [{ file: "binaural-focus.mp3", gain: 1.0, pan: 0, loop: true }],
            om_drone:         [{ file: "om-drone.mp3", gain: 1.0, pan: 0, loop: true }],
            solfeggio:        [{ file: "solfeggio.mp3", gain: 1.0, pan: 0, loop: true }],
            nature_rain:      [
                { file: "rain.mp3", gain: 0.9, pan: 0, loop: true },
                { file: "thunder.mp3", gain: 0.3, pan: 0.2, loop: true },
            ],
            ocean_waves:      [{ file: "ocean.mp3", gain: 1.0, pan: 0, loop: true }],
            theta_meditation: [{ file: "theta-meditation.mp3", gain: 1.0, pan: 0, loop: true }],
            chakra_tune:      [{ file: "chakra.mp3", gain: 1.0, pan: 0, loop: true }],
        };

        this.SYNTH_MAP = {
            adhd_smr:           { type: 'binaural',   carrier: 200,  beat: 13,  label: 'SMR 13 Hz' },
            ptsd_theta:         { type: 'binaural',   carrier: 432,  beat: 6,   label: 'Theta 6 Hz @ 432 Hz' },
            chronic_pain_delta: { type: 'isochronic', carrier: 174,  beat: 2,   label: 'Delta 2 Hz @ 174 Hz' },
            tinnitus_mask:      { type: 'noise',      notchFreq: 5000,           label: 'Notched Pink Noise' },
            parkinsons_ras:     { type: 'metronome',  bpm: 130,                  label: '130 BPM RAS' },
            aphasia_melody:     { type: 'melody',                                label: 'MIT Pentatonic' },
            gamma_40hz:         { type: 'binaural',   carrier: 100,  beat: 40,  label: 'Gamma 40 Hz' },
        };

        // DAF state
        this._dafActive = false;
        this._dafStream = null;
        this._dafMicSource = null;
        this._dafDelay = null;
        this._dafGain = null;

        // Synth timer handles
        this._rasTimer = null;
        this._mitTimer = null;
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.ctx.destination);
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.82;
        this.masterGain.connect(this.analyser);
        console.log("[TherapyAudio] Initialized. Sample rate:", this.ctx.sampleRate);
    }

    getFrequencyData() {
        if (!this.analyser) return null;
        const data = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(data);
        return data;
    }

    getTimeDomainData() {
        if (!this.analyser) return null;
        const data = new Uint8Array(this.analyser.fftSize);
        this.analyser.getByteTimeDomainData(data);
        return data;
    }

    /** Preload all audio files into buffer cache for instant playback. */
    async preload() {
        this.init();
        const allFiles = new Set();
        Object.values(this.SOUND_MAP).forEach(layers => {
            layers.forEach(l => allFiles.add(l.file));
        });
        const promises = [...allFiles].map(file => this._loadAudio(file));
        try {
            await Promise.all(promises);
            console.log("[TherapyAudio] All sounds preloaded:", allFiles.size, "files");
        } catch (e) {
            console.warn("[TherapyAudio] Some sounds failed to preload:", e.message);
        }
    }

    async _loadAudio(filename) {
        if (this._bufferCache[filename]) return this._bufferCache[filename];
        if (this._loading[filename]) return this._loading[filename];
        const url = this.AUDIO_BASE + filename;
        console.log("[TherapyAudio] Loading:", filename);
        this._loading[filename] = (async () => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status} for ${filename}`);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                this._bufferCache[filename] = audioBuffer;
                console.log("[TherapyAudio] Loaded:", filename,
                    `(${audioBuffer.duration.toFixed(1)}s, ${audioBuffer.numberOfChannels}ch)`);
                return audioBuffer;
            } catch (e) {
                console.error("[TherapyAudio] Failed to load:", filename, e.message);
                throw e;
            } finally {
                delete this._loading[filename];
            }
        })();
        return this._loading[filename];
    }

    /**
     * Start playing a therapy sound.
     * @param {string} type - Therapy key from SOUND_MAP or SYNTH_MAP
     * @param {number} volume - 0 to 1
     */
    async play(type, volume = 0.3) {
        this.init();
        this._stopImmediate();
        this.currentTherapy = type;
        this.isPlaying = true;
        this._targetVolume = volume;

        if (this.SYNTH_MAP[type]) {
            if (this.ctx.state === "suspended") await this.ctx.resume();
            this._playSynth(type, volume);
            this.masterGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 2);
            return;
        }

        const layers = this.SOUND_MAP[type];
        if (!layers) {
            console.warn("[TherapyAudio] Unknown type:", type, "- falling back to om_drone");
            return this.play("om_drone", volume);
        }

        if (this.ctx.state === "suspended") await this.ctx.resume();

        const playPromises = layers.map(async (layer) => {
            try {
                const buffer = await this._loadAudio(layer.file);
                if (this.currentTherapy !== type) return;
                this._playLayer(buffer, layer);
            } catch (e) {
                console.warn("[TherapyAudio] Skipping layer:", layer.file, e.message);
            }
        });
        await Promise.all(playPromises);

        if (this.currentTherapy === type) {
            this.masterGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 2);
        }
    }

    /**
     * Play with environment-adaptive processing (pitch, EQ, reverb, LFO).
     * @param {string} type - Therapy type
     * @param {number} volume - 0 to 1
     * @param {string} environment - home, office, outdoors, commute, gym, nature
     */
    async playProcessed(type, volume = 0.3, environment = "home") {
        this.init();
        this._stopImmediate();
        this.currentTherapy = type;
        this.isPlaying = true;
        this._targetVolume = volume;

        const layers = this.SOUND_MAP[type];
        if (!layers) return this.play("om_drone", volume);
        if (this.ctx.state === "suspended") await this.ctx.resume();

        const ENV_FX = {
            home:     { pitchRate: 1.0,  lowpass: 18000, highpass: 20,  reverb: 0.2,  lfoRate: 0,    lfoDepth: 0 },
            office:   { pitchRate: 1.0,  lowpass: 8000,  highpass: 100, reverb: 0.1,  lfoRate: 0,    lfoDepth: 0 },
            outdoors: { pitchRate: 0.95, lowpass: 14000, highpass: 40,  reverb: 0.4,  lfoRate: 0.06, lfoDepth: 0.08 },
            commute:  { pitchRate: 1.02, lowpass: 6000,  highpass: 150, reverb: 0.05, lfoRate: 0,    lfoDepth: 0 },
            gym:      { pitchRate: 1.05, lowpass: 12000, highpass: 60,  reverb: 0.15, lfoRate: 0.1,  lfoDepth: 0.05 },
            nature:   { pitchRate: 0.98, lowpass: 16000, highpass: 30,  reverb: 0.5,  lfoRate: 0.04, lfoDepth: 0.1 },
        };
        const fx = ENV_FX[environment] || ENV_FX.home;

        const playPromises = layers.map(async (layer) => {
            try {
                const buffer = await this._loadAudio(layer.file);
                if (this.currentTherapy !== type) return;
                this._playProcessedLayer(buffer, layer, fx);
            } catch (e) {
                console.warn("[TherapyAudio] Skipping layer:", layer.file, e.message);
            }
        });
        await Promise.all(playPromises);

        if (this.currentTherapy === type) {
            this.masterGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 2);
        }
    }

    _playProcessedLayer(audioBuffer, layerConfig, fx) {
        const source = this.ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.loop = layerConfig.loop !== false;
        source.playbackRate.value = fx.pitchRate || 1.0;

        const lpf = this.ctx.createBiquadFilter();
        lpf.type = "lowpass";
        lpf.frequency.value = fx.lowpass || 18000;
        lpf.Q.value = 0.7;

        const hpf = this.ctx.createBiquadFilter();
        hpf.type = "highpass";
        hpf.frequency.value = fx.highpass || 20;
        hpf.Q.value = 0.5;

        const gain = this.ctx.createGain();
        gain.gain.value = layerConfig.gain || 1.0;

        const panner = this.ctx.createStereoPanner();
        panner.pan.value = layerConfig.pan || 0;

        // LFO amplitude modulation (breathing/wave effect for nature/outdoors)
        if (fx.lfoRate > 0 && fx.lfoDepth > 0) {
            const lfo = this.ctx.createOscillator();
            lfo.type = "sine";
            lfo.frequency.value = fx.lfoRate;
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = fx.lfoDepth;
            lfo.connect(lfoGain);
            lfoGain.connect(gain.gain);
            lfo.start();
            this.activeNodes.push(lfo);
        }

        // Lightweight delay-feedback reverb (no convolution needed)
        if (fx.reverb > 0.1) {
            const delay = this.ctx.createDelay(0.5);
            delay.delayTime.value = 0.15;
            const feedback = this.ctx.createGain();
            feedback.gain.value = fx.reverb;
            const reverbGain = this.ctx.createGain();
            reverbGain.gain.value = fx.reverb * 0.6;

            // Dry path
            source.connect(lpf); lpf.connect(hpf); hpf.connect(gain);
            gain.connect(panner); panner.connect(this.masterGain);
            // Wet path (feedback loop)
            gain.connect(delay); delay.connect(feedback); feedback.connect(delay);
            delay.connect(reverbGain); reverbGain.connect(this.masterGain);
        } else {
            source.connect(lpf); lpf.connect(hpf); hpf.connect(gain);
            gain.connect(panner); panner.connect(this.masterGain);
        }

        source.start(0);
        this.activeNodes.push(source);

        if (!source.loop) {
            source.onended = () => {
                const idx = this.activeNodes.indexOf(source);
                if (idx !== -1) this.activeNodes.splice(idx, 1);
                try { source.disconnect(); } catch (e) {}
            };
        }
    }

    _playLayer(audioBuffer, layerConfig) {
        const source = this.ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.loop = layerConfig.loop !== false;
        const gain = this.ctx.createGain();
        gain.gain.value = layerConfig.gain || 1.0;
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = layerConfig.pan || 0;

        source.connect(gain); gain.connect(panner); panner.connect(this.masterGain);
        source.start(0);
        this.activeNodes.push(source);

        if (!source.loop) {
            source.onended = () => {
                const idx = this.activeNodes.indexOf(source);
                if (idx !== -1) this.activeNodes.splice(idx, 1);
                try { source.disconnect(); } catch (e) {}
            };
        }
    }

    /** Stop with fade-out */
    stop() {
        if (!this.ctx) return;
        if (this._stopTimeout) { clearTimeout(this._stopTimeout); this._stopTimeout = null; }
        if (this._rasTimer) { clearTimeout(this._rasTimer); this._rasTimer = null; }
        if (this._mitTimer) { clearTimeout(this._mitTimer); this._mitTimer = null; }

        this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
        const nodesToClean = [...this.activeNodes];
        this.activeNodes = [];
        this.isPlaying = false;
        this.currentTherapy = null;
        this._stopTimeout = setTimeout(() => {
            nodesToClean.forEach(node => {
                try { node.stop(); } catch (e) {}
                try { node.disconnect(); } catch (e) {}
            });
            this._stopTimeout = null;
        }, 1500);
    }

    _stopImmediate() {
        if (!this.ctx) return;
        if (this._stopTimeout) { clearTimeout(this._stopTimeout); this._stopTimeout = null; }
        if (this._rasTimer) { clearTimeout(this._rasTimer); this._rasTimer = null; }
        if (this._mitTimer) { clearTimeout(this._mitTimer); this._mitTimer = null; }

        this.activeNodes.forEach(node => {
            try { node.stop(); } catch (e) {}
            try { node.disconnect(); } catch (e) {}
        });
        this.activeNodes = [];
        this.isPlaying = false;
        this.currentTherapy = null;
        this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }

    setVolume(vol) {
        this._targetVolume = vol;
        if (!this.ctx || !this.isPlaying) return;
        this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.5);
    }

    /** Duck volume when agent is speaking */
    duck() {
        if (!this.ctx || !this.isPlaying) return;
        this.masterGain.gain.setTargetAtTime(0.08, this.ctx.currentTime, 0.3);
    }

    /** Light duck — therapy stays prominent during meditation */
    meditationDuck() {
        if (!this.ctx || !this.isPlaying) return;
        const target = (this._targetVolume || 0.5) * 0.7;
        this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.3);
    }

    /** Restore volume after agent stops speaking */
    unduck() {
        if (!this.ctx || !this.isPlaying) return;
        const vol = this._targetVolume || 0.3;
        this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.5);
    }

    /**
     * Play a custom mix of multiple therapy sounds layered together.
     * @param {Array} layers - Array of { type: string, volume: number }
     */
    async playMix(layers, masterVolume = 0.3) {
        this.init();
        this._stopImmediate();
        this.currentTherapy = "mix";
        this.isPlaying = true;
        this._targetVolume = masterVolume;
        if (this.ctx.state === "suspended") await this.ctx.resume();

        const allFiles = [];
        layers.forEach(layer => {
            const soundLayers = this.SOUND_MAP[layer.type];
            if (soundLayers) {
                soundLayers.forEach(sl => {
                    allFiles.push({
                        file: sl.file,
                        gain: (sl.gain || 1.0) * (layer.volume || 0.5),
                        pan: sl.pan || 0,
                        loop: sl.loop !== false,
                    });
                });
            }
        });

        const playPromises = allFiles.map(async (layerConfig) => {
            try {
                const buffer = await this._loadAudio(layerConfig.file);
                if (this.currentTherapy !== "mix") return;
                this._playLayer(buffer, layerConfig);
            } catch (e) {
                console.warn("[TherapyAudio] Mix: skipping layer:", layerConfig.file, e.message);
            }
        });
        await Promise.all(playPromises);

        if (this.currentTherapy === "mix") {
            this.masterGain.gain.setTargetAtTime(masterVolume, this.ctx.currentTime, 2);
        }
    }

    startRecording() {
        if (!this.ctx || !this.isPlaying) return false;
        const dest = this.ctx.createMediaStreamDestination();
        this.masterGain.connect(dest);
        this._recordDest = dest;
        this._recorder = new MediaRecorder(dest.stream);
        this._recordedChunks = [];
        this._recorder.ondataavailable = (e) => {
            if (e.data.size > 0) this._recordedChunks.push(e.data);
        };
        this._recorder.start();
        this._isRecording = true;
        return true;
    }

    stopRecordingAndDownload() {
        if (!this._recorder || !this._isRecording) return;
        return new Promise((resolve) => {
            this._recorder.onstop = () => {
                const blob = new Blob(this._recordedChunks, { type: "audio/webm" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `naada-${this.currentTherapy || "therapy"}-${Date.now()}.webm`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                this._isRecording = false;
                if (this._recordDest) {
                    try { this.masterGain.disconnect(this._recordDest); } catch (e) {}
                }
                resolve();
            };
            this._recorder.stop();
        });
    }

    get isRecording() { return this._isRecording || false; }

    // --- Synthesized Therapy Engine ---

    _playSynth(type, volume) {
        const cfg = this.SYNTH_MAP[type];
        if (!cfg) return;
        switch (cfg.type) {
            case 'binaural':   this._playBinaural(cfg.carrier, cfg.beat, volume); break;
            case 'isochronic': this._playIsochronic(cfg.carrier, cfg.beat, volume); break;
            case 'noise':      this._playWhiteNoise(cfg.notchFreq || 0, volume); break;
            case 'metronome':  this._playMetronome(cfg.bpm, volume); break;
            case 'melody':     this._playMelodicIntonation(volume); break;
        }
    }

    /**
     * Binaural beats: L ear = carrier - beat/2, R ear = carrier + beat/2.
     * Brain perceives the difference as brainwave entrainment. Requires headphones.
     */
    _playBinaural(carrierHz, beatHz, volume) {
        const lFreq = carrierHz - beatHz / 2;
        const rFreq = carrierHz + beatHz / 2;

        const makeOsc = (freq, pan, gain) => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const g = this.ctx.createGain();
            g.gain.value = gain;
            const p = this.ctx.createStereoPanner();
            p.pan.value = pan;
            osc.connect(g); g.connect(p); p.connect(this.masterGain);
            osc.start();
            this.activeNodes.push(osc, g, p);
        };

        makeOsc(lFreq, -1, volume * 0.85);
        makeOsc(rFreq,  1, volume * 0.85);
        // Subtle overtones for richness
        makeOsc(lFreq * 2, -0.5, volume * 0.08);
        makeOsc(rFreq * 2,  0.5, volume * 0.08);
    }

    /**
     * Isochronic tones: carrier AM-modulated at the beat frequency.
     * Works without headphones (unlike binaural). Used for clinical brainwave entrainment.
     */
    _playIsochronic(carrierHz, beatHz, volume) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = carrierHz;
        const amGain = this.ctx.createGain();
        amGain.gain.value = 0;

        // DC offset so gain oscillates 0-1 instead of -1 to +1
        const dc = this.ctx.createConstantSource();
        dc.offset.value = volume * 0.5;
        const modOsc = this.ctx.createOscillator();
        modOsc.type = 'sine';
        modOsc.frequency.value = beatHz;
        const modDepth = this.ctx.createGain();
        modDepth.gain.value = volume * 0.5;

        modOsc.connect(modDepth); modDepth.connect(amGain.gain);
        dc.connect(amGain.gain);
        osc.connect(amGain); amGain.connect(this.masterGain);
        osc.start(); modOsc.start(); dc.start();
        this.activeNodes.push(osc, modOsc, amGain, modDepth, dc);
    }

    /**
     * Notched pink noise for tinnitus sound therapy.
     * Auditory cortex "fills in" the notch, reducing tinnitus perception over time.
     */
    _playWhiteNoise(notchFreqHz, volume) {
        const bufSize = this.ctx.sampleRate * 4;
        const buf = this.ctx.createBuffer(2, bufSize, this.ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = buf.getChannelData(ch);
            // Paul Kellett's pink noise algorithm
            let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
            for (let i = 0; i < bufSize; i++) {
                const w = Math.random() * 2 - 1;
                b0 = 0.99886*b0 + w*0.0555179; b1 = 0.99332*b1 + w*0.0750759;
                b2 = 0.96900*b2 + w*0.1538520; b3 = 0.86650*b3 + w*0.3104856;
                b4 = 0.55000*b4 + w*0.5329522; b5 = -0.7616*b5 - w*0.0168980;
                data[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362) * 0.11;
                b6 = w * 0.115926;
            }
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const notch = this.ctx.createBiquadFilter();
        notch.type = 'notch';
        notch.frequency.value = notchFreqHz || 5000;
        notch.Q.value = 6;
        const lpf = this.ctx.createBiquadFilter();
        lpf.type = 'lowpass';
        lpf.frequency.value = 10000;

        src.connect(notch); notch.connect(lpf); lpf.connect(this.masterGain);
        src.start();
        this.activeNodes.push(src);
    }

    /**
     * Rhythmic Auditory Stimulation (RAS) metronome.
     * Entrains gait to external beat, bypassing damaged basal ganglia timing circuits.
     */
    _playMetronome(bpm, volume) {
        const secPerBeat = 60 / bpm;
        let nextBeat = this.ctx.currentTime + 0.05;
        const lookahead = 0.15;

        const schedule = () => {
            if (!this.isPlaying || this.currentTherapy !== 'parkinsons_ras') return;
            while (nextBeat < this.ctx.currentTime + lookahead) {
                // Accent click (880 Hz)
                const c = this.ctx.createOscillator(); c.type = 'sine'; c.frequency.value = 880;
                const e = this.ctx.createGain();
                e.gain.setValueAtTime(0, nextBeat);
                e.gain.linearRampToValueAtTime(volume * 1.4, nextBeat + 0.008);
                e.gain.exponentialRampToValueAtTime(0.0001, nextBeat + 0.06);
                c.connect(e); e.connect(this.masterGain);
                c.start(nextBeat); c.stop(nextBeat + 0.07);
                // Sub harmonic (440 Hz for warmth)
                const s = this.ctx.createOscillator(); s.type = 'sine'; s.frequency.value = 440;
                const se = this.ctx.createGain();
                se.gain.setValueAtTime(0, nextBeat);
                se.gain.linearRampToValueAtTime(volume * 0.4, nextBeat + 0.006);
                se.gain.exponentialRampToValueAtTime(0.0001, nextBeat + 0.04);
                s.connect(se); se.connect(this.masterGain);
                s.start(nextBeat); s.stop(nextBeat + 0.05);
                nextBeat += secPerBeat;
            }
            this._rasTimer = setTimeout(schedule, lookahead * 500);
        };
        schedule();
    }

    /**
     * Melodic Intonation Therapy (MIT) for aphasia rehabilitation.
     * Pentatonic melodies activate right-hemisphere language areas that survive left-hemisphere stroke.
     */
    _playMelodicIntonation(volume) {
        // G pentatonic (G3-A3-B3-D4-E4): naturally calming, widely used in music therapy
        const notes = [196.00, 220.00, 246.94, 293.66, 329.63];
        const pattern = [0,1,2,3,4,3,2,1,0,2,4,3,1,0];
        const durations = [0.55,0.45,0.6,0.5,0.45,0.55,0.6,0.45,0.55,0.5,0.45,0.6,0.5,0.55];
        const totalDur = durations.reduce((a,b)=>a+b,0);

        const playNote = (freq, t, dur) => {
            const osc = this.ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
            // Vibrato for natural vocal warmth
            const vib = this.ctx.createOscillator(); vib.frequency.value = 5.2;
            const vd = this.ctx.createGain(); vd.gain.value = 4;
            vib.connect(vd); vd.connect(osc.frequency);
            const env = this.ctx.createGain();
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(volume * 0.55, t + dur*0.1);
            env.gain.setValueAtTime(volume * 0.55, t + dur*0.85);
            env.gain.linearRampToValueAtTime(0, t + dur);
            osc.connect(env); env.connect(this.masterGain);
            osc.start(t); vib.start(t);
            osc.stop(t+dur+0.01); vib.stop(t+dur+0.01);
        };

        const playLoop = () => {
            if (!this.isPlaying || this.currentTherapy !== 'aphasia_melody') return;
            let t = this.ctx.currentTime + 0.05;
            pattern.forEach((ni, i) => { playNote(notes[ni], t, durations[i%durations.length]); t += durations[i%durations.length]; });
            this._mitTimer = setTimeout(playLoop, (totalDur + 0.6) * 1000);
        };
        playLoop();
    }

    // --- Delayed Auditory Feedback (DAF) ---

    /**
     * Start DAF: mic -> delay -> speakers.
     * Triggers Lombard effect, slowing speech rate and reducing stuttering 40-80%.
     * @param {number} delaySeconds - Default 0.15 (150ms)
     */
    async startDAF(delaySeconds = 0.15) {
        if (this._dafActive) return true;
        try {
            this.init();
            if (this.ctx.state === 'suspended') await this.ctx.resume();
            this._dafStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
            });
            const micSrc = this.ctx.createMediaStreamSource(this._dafStream);
            this._dafDelay = this.ctx.createDelay(2.0);
            this._dafDelay.delayTime.value = delaySeconds;
            const g = this.ctx.createGain(); g.gain.value = 0.85;
            micSrc.connect(this._dafDelay);
            this._dafDelay.connect(g);
            g.connect(this.ctx.destination); // Direct to output, NOT masterGain
            this._dafMicSource = micSrc;
            this._dafGain = g;
            this._dafActive = true;
            this._dafDelayMs = Math.round(delaySeconds * 1000);
            console.log('[TherapyAudio] DAF active:', delaySeconds, 's');
            return true;
        } catch (e) {
            console.error('[TherapyAudio] DAF failed:', e.message);
            return false;
        }
    }

    stopDAF() {
        if (!this._dafActive) return;
        try { this._dafMicSource && this._dafMicSource.disconnect(); } catch(e){}
        try { this._dafDelay && this._dafDelay.disconnect(); } catch(e){}
        try { this._dafGain && this._dafGain.disconnect(); } catch(e){}
        if (this._dafStream) { this._dafStream.getTracks().forEach(t => t.stop()); }
        this._dafActive = false; this._dafStream = null;
        this._dafMicSource = null; this._dafDelay = null; this._dafGain = null;
        console.log('[TherapyAudio] DAF stopped');
    }

    setDAFDelay(delaySeconds) {
        if (this._dafDelay) {
            this._dafDelay.delayTime.setTargetAtTime(delaySeconds, this.ctx.currentTime, 0.05);
            this._dafDelayMs = Math.round(delaySeconds * 1000);
        }
    }

    get isDafActive() { return this._dafActive; }

    // --- Neurotone Analysis ---

    /**
     * Analyze mic input for ~3s to find fundamental voice frequency.
     * Maps to nearest solfeggio harmonic and recommends therapy.
     * @param {function} onProgress - Called with 0-1 during analysis
     * @returns {object|null} Neurotone profile
     */
    async analyzeNeurotone(onProgress) {
        try {
            this.init();
            if (this.ctx.state === 'suspended') await this.ctx.resume();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const micSrc = this.ctx.createMediaStreamSource(stream);
            const analyser = this.ctx.createAnalyser();
            analyser.fftSize = 8192;
            analyser.smoothingTimeConstant = 0.4;
            micSrc.connect(analyser);

            const samples = [];
            const DURATION = 3200;
            const INTERVAL = 120;

            return new Promise(resolve => {
                const tick = setInterval(() => {
                    const fd = new Float32Array(analyser.frequencyBinCount);
                    analyser.getFloatFrequencyData(fd);
                    const sr = this.ctx.sampleRate;
                    const minBin = Math.floor(80 * analyser.fftSize / sr);
                    const maxBin = Math.floor(320 * analyser.fftSize / sr);
                    let maxDb = -Infinity, peakBin = minBin;
                    for (let i = minBin; i <= maxBin; i++) {
                        if (fd[i] > maxDb) { maxDb = fd[i]; peakBin = i; }
                    }
                    const freq = peakBin * (sr / 2) / analyser.frequencyBinCount;
                    if (maxDb > -55) samples.push(freq);
                    if (onProgress) onProgress(Math.min(samples.length / (DURATION / INTERVAL), 1));
                }, INTERVAL);

                setTimeout(() => {
                    clearInterval(tick);
                    stream.getTracks().forEach(t => t.stop());
                    try { micSrc.disconnect(); } catch(e) {}
                    if (samples.length < 5) { resolve(null); return; }

                    // Trimmed mean (20th-80th percentile) for robust fundamental estimation
                    samples.sort((a, b) => a - b);
                    const t1 = Math.floor(samples.length * 0.2), t2 = Math.floor(samples.length * 0.8);
                    const avg = samples.slice(t1, t2).reduce((a,b)=>a+b,0) / (t2-t1);
                    const fundamental = Math.round(avg);

                    const VT = fundamental < 100 ? ['Bass','🎸'] : fundamental < 145 ? ['Baritone','🎵'] :
                               fundamental < 185 ? ['Tenor','🎤'] : fundamental < 225 ? ['Alto','🎶'] :
                               fundamental < 270 ? ['Mezzo-Soprano','🎼'] : ['Soprano','✨'];

                    // Nearest solfeggio by harmonic resonance
                    const SOLF = [174,285,396,417,528,639,741,852,963];
                    const SOLF_NAMES = { 174:'Pain Relief',285:'Tissue Repair',396:'Fear Release',
                        417:'Facilitating Change',528:'Love Frequency',639:'Relationships',
                        741:'Intuition',852:'Spiritual Order',963:'Awakening' };
                    const SOLF_THERAPY = { 174:'chronic_pain_delta',285:'solfeggio',396:'tibetan_bowls',
                        417:'tibetan_bowls',528:'solfeggio',639:'indian_raga',
                        741:'theta_meditation',852:'chakra_tune',963:'om_drone' };

                    let bestSolf = SOLF[0], bestScore = Infinity;
                    for (const sf of SOLF) {
                        const h = Math.max(1, Math.round(fundamental / sf));
                        const dist = Math.abs(sf * h - fundamental);
                        if (dist < bestScore) { bestScore = dist; bestSolf = sf; }
                    }
                    const resonancePct = Math.max(10, Math.round(100 - Math.min(bestScore, 90)));

                    const brainwaveHint = fundamental < 130 ? 'Delta harmonics — natural healing resonance' :
                        fundamental < 200 ? 'Theta harmonics — deep meditative potential' :
                        fundamental < 260 ? 'Alpha harmonics — relaxation-ready voice' :
                                            'Beta resonance — focused analytical processor';

                    resolve({ fundamental, voiceType: VT[0], voiceIcon: VT[1],
                        nearestSolfeggio: bestSolf, solfeggioName: SOLF_NAMES[bestSolf],
                        recommendedTherapy: SOLF_THERAPY[bestSolf] || 'solfeggio',
                        resonanceScore: resonancePct, brainwaveHint, sampleCount: samples.length });
                }, DURATION);
            });
        } catch(e) {
            console.error('[TherapyAudio] Neurotone analysis failed:', e.message);
            return null;
        }
    }

    destroy() {
        this.stop();
        this.stopDAF();
        if (this.ctx && this.ctx.state !== "closed") this.ctx.close();
        this.ctx = null;
        this._bufferCache = {};
    }
}
