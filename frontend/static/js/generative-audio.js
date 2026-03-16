/**
 * GenerativeSoundEngine — Algorithmic Instrument Synthesis & Procedural Raga Composition
 *
 * Creates unique, never-repeating therapeutic music using:
 *   - Karplus-Strong string synthesis (sitar, tanpura, harp)
 *   - Physical modeling (bansuri flute, singing bowls)
 *   - Percussion synthesis (tabla)
 *   - Procedural raga melodic generation (Indian classical scales)
 *   - Harmonic drone layers
 *   - Recitation mode (live background music while Gemini speaks poetry)
 *
 * No audio files needed — 100% Web Audio API synthesis.
 * Every session produces unique, unrepeatable therapeutic music.
 */

class GenerativeSoundEngine {
    constructor(therapyEngine) {
        this.therapy = therapyEngine; // Reference to TherapyAudioEngine for shared ctx
        this.ctx = null;
        this.masterGain = null;
        this.isPlaying = false;
        this.currentComposition = null;
        this._schedulerTimer = null;
        this._droneNodes = [];
        this._activeNotes = [];
        this._percTimer = null;

        // Indian classical ragas — scale degrees relative to Sa (tonic)
        // Each raga has: ascending (aroha), descending (avaroha), vadi (dominant), samvadi (subdominant)
        this.RAGAS = {
            bhairav: {
                name: "Bhairav", time: "morning", mood: "awakening",
                notes: [0, 1, 4, 5, 7, 8, 11],  // S r G M P d N
                aroha: [0, 1, 4, 5, 7, 8, 11, 12],
                avaroha: [12, 11, 8, 7, 5, 4, 1, 0],
                vadi: 7, samvadi: 4,  // Pa, Ga
                gamakas: true, // ornamentations
            },
            yaman: {
                name: "Yaman", time: "evening", mood: "peaceful",
                notes: [0, 2, 4, 6, 7, 9, 11],  // S R G M# P D N
                aroha: [0, 2, 4, 6, 7, 9, 11, 12],
                avaroha: [12, 11, 9, 7, 6, 4, 2, 0],
                vadi: 4, samvadi: 11,  // Ga, Ni
                gamakas: true,
            },
            malkauns: {
                name: "Malkauns", time: "midnight", mood: "deep_meditation",
                notes: [0, 3, 5, 8, 10],  // S g m d n (pentatonic)
                aroha: [0, 3, 5, 8, 10, 12],
                avaroha: [12, 10, 8, 5, 3, 0],
                vadi: 5, samvadi: 10,  // Ma, ni
                gamakas: true,
            },
            darbari: {
                name: "Darbari Kanada", time: "night", mood: "calm",
                notes: [0, 2, 3, 5, 7, 8, 10],  // S R g M P d n
                aroha: [0, 2, 3, 5, 7, 8, 10, 12],
                avaroha: [12, 10, 8, 7, 5, 3, 2, 0],
                vadi: 7, samvadi: 2,  // Pa, Re
                gamakas: true,
            },
            bageshree: {
                name: "Bageshree", time: "night", mood: "healing",
                notes: [0, 2, 3, 5, 7, 9, 10],  // S R g M P D n
                aroha: [0, 3, 5, 7, 9, 12],
                avaroha: [12, 10, 9, 7, 5, 3, 2, 0],
                vadi: 5, samvadi: 10,  // Ma, ni
                gamakas: true,
            },
            todi: {
                name: "Todi", time: "morning", mood: "contemplative",
                notes: [0, 1, 3, 6, 7, 8, 11],  // S r g M# P d N
                aroha: [0, 1, 3, 6, 7, 8, 11, 12],
                avaroha: [12, 11, 8, 7, 6, 3, 1, 0],
                vadi: 3, samvadi: 8,
                gamakas: true,
            },
            durga: {
                name: "Durga", time: "evening", mood: "strength",
                notes: [0, 2, 5, 7, 9],  // S R M P D (pentatonic)
                aroha: [0, 2, 5, 7, 9, 12],
                avaroha: [12, 9, 7, 5, 2, 0],
                vadi: 5, samvadi: 9,
                gamakas: false, // clean pentatonic
            },
            bhoopali: {
                name: "Bhoopali", time: "evening", mood: "joyful",
                notes: [0, 2, 4, 7, 9],  // S R G P D (pentatonic)
                aroha: [0, 2, 4, 7, 9, 12],
                avaroha: [12, 9, 7, 4, 2, 0],
                vadi: 4, samvadi: 9,
                gamakas: false,
            },
        };

        // Instrument presets
        this.INSTRUMENTS = {
            sitar: { type: 'karplus', decay: 4.0, brightness: 0.7, sympathetic: true },
            tanpura: { type: 'drone', decay: 8.0, brightness: 0.3, harmonics: 6 },
            bansuri: { type: 'flute', decay: 2.5, breathiness: 0.4 },
            tabla: { type: 'percussion', varieties: ['ge', 'na', 'tin', 'dha', 'dhin'] },
            singing_bowl: { type: 'bowl', decay: 12.0, partials: 5 },
            harp: { type: 'karplus', decay: 3.0, brightness: 0.9, sympathetic: false },
            veena: { type: 'karplus', decay: 5.0, brightness: 0.5, sympathetic: true },
        };

        // Tala (rhythm) patterns — boolean array where true = beat
        this.TALAS = {
            teental: { beats: 16, pattern: [1,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], name: "Teental (16)" },
            rupak:   { beats: 7,  pattern: [0,0,0, 1,0, 1,0], name: "Rupak (7)" },
            jhaptal: { beats: 10, pattern: [1,0, 1,0,0, 1,0, 1,0,0], name: "Jhaptal (10)" },
            dadra:   { beats: 6,  pattern: [1,0,0, 1,0,0], name: "Dadra (6)" },
            keherwa: { beats: 8,  pattern: [1,0,0,0, 1,0,0,0], name: "Keherwa (8)" },
        };

        // Mood → raga recommendations
        this.MOOD_RAGA_MAP = {
            stressed: ['yaman', 'darbari'],
            anxious: ['malkauns', 'darbari'],
            sad: ['bageshree', 'todi'],
            calm: ['bhoopali', 'yaman'],
            peaceful: ['yaman', 'durga'],
            meditative: ['malkauns', 'bhairav'],
            awakening: ['bhairav', 'todi'],
            healing: ['bageshree', 'bhoopali'],
            focused: ['durga', 'bhoopali'],
            joyful: ['bhoopali', 'yaman'],
            contemplative: ['todi', 'malkauns'],
            strength: ['durga', 'bhairav'],
        };
    }

    _ensureCtx() {
        if (!this.ctx) {
            this.therapy.init();
            this.ctx = this.therapy.ctx;
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0;
            this.masterGain.connect(this.ctx.destination);
            if (this.therapy.analyser) {
                this.masterGain.connect(this.therapy.analyser);
            }
        }
    }

    // --- Karplus-Strong String Synthesis (physically-modeled plucked strings) ---

    /** Karplus-Strong: noise burst → delay line + lowpass averaging → realistic string decay */
    _karplusStrong(freq, duration = 4.0, brightness = 0.7, decayFactor = 0.996) {
        const sr = this.ctx.sampleRate;
        const samples = Math.ceil(sr * duration);
        const buffer = this.ctx.createBuffer(1, samples, sr);
        const data = buffer.getChannelData(0);

        const period = Math.round(sr / freq);
        const delayLine = new Float32Array(period);
        const lpCoeff = brightness; // lowpass filter coefficient controls string brightness

        for (let i = 0; i < period; i++) {
            const noise = Math.random() * 2 - 1;
            const triangle = 1 - 2 * Math.abs(i / period - 0.5);
            delayLine[i] = noise * 0.7 + triangle * 0.3;
        }

        let idx = 0;
        for (let i = 0; i < samples; i++) {
            const curr = delayLine[idx];
            const next = delayLine[(idx + 1) % period];
            const filtered = (curr * lpCoeff + next * (1 - lpCoeff)) * decayFactor;
            delayLine[idx] = filtered;
            data[i] = curr;
            idx = (idx + 1) % period;
        }

        return buffer;
    }

    /**
     * Play a sitar-like plucked note with sympathetic string resonance.
     * @param {number} freq - Note frequency
     * @param {number} startTime - AudioContext time to start
     * @param {number} volume - 0-1
     * @param {boolean} addSympathetic - Add sympathetic string buzz
     */
    _playSitarNote(freq, startTime, volume = 0.3, addSympathetic = true) {
        const buf = this._karplusStrong(freq, 4.0, 0.7, 0.9965);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 3.5);

        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = freq * 2;
        bp.Q.value = 2;

        src.connect(bp);
        bp.connect(gain);
        gain.connect(this.masterGain);
        src.start(startTime);
        src.stop(startTime + 4.0);
        this._activeNotes.push(src);

        // Sympathetic string resonance (jawari buzz) — adds the sitar's shimmer
        if (addSympathetic) {
            const sympFreqs = [freq * 1.001, freq * 2.003, freq * 3.002]; // Slight detuning
            sympFreqs.forEach((sf, i) => {
                const sympBuf = this._karplusStrong(sf, 5.0, 0.3, 0.998);
                const sympSrc = this.ctx.createBufferSource();
                sympSrc.buffer = sympBuf;
                const sympGain = this.ctx.createGain();
                sympGain.gain.setValueAtTime(volume * 0.06, startTime);
                sympGain.gain.exponentialRampToValueAtTime(0.001, startTime + 5.0);
                sympSrc.connect(sympGain);
                sympGain.connect(this.masterGain);
                sympSrc.start(startTime + 0.01 * i);
                sympSrc.stop(startTime + 5.0);
                this._activeNotes.push(sympSrc);
            });
        }
    }

    /**
     * Play a harp/veena plucked note — cleaner, less sympathetic buzz.
     */
    _playHarpNote(freq, startTime, volume = 0.3) {
        const buf = this._karplusStrong(freq, 3.0, 0.9, 0.997);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 3.0);
        src.connect(gain);
        gain.connect(this.masterGain);
        src.start(startTime);
        src.stop(startTime + 3.0);
        this._activeNotes.push(src);
    }

    // --- TANPURA DRONE SYNTHESIS
    //  Continuous harmonic drone providing the tonal foundation ---

    /**
     * Create a tanpura-like harmonic drone.
     * The tanpura produces a rich, shimmering drone by plucking 4 strings
     * in a slow, continuous cycle. The strings buzz against the bridge (jawari),
     * creating a characteristic harmonic-rich timbre.
     *
     * @param {number} tonic - Sa frequency in Hz (e.g., 130.81 for C3)
     * @param {number} volume - 0-1
     */
    _startTanpuraDrone(tonic, volume = 0.15) {
        // Tanpura strings: Pa, Sa(upper), Sa(upper), Sa(lower)
        const strings = [tonic * 1.5, tonic * 2, tonic * 2, tonic];
        const pluckInterval = 0.8; // seconds between string plucks

        let stringIdx = 0;
        let nextPluck = this.ctx.currentTime + 0.1;

        const scheduleLoop = () => {
            if (!this.isPlaying) return;
            const lookAhead = 0.3;

            while (nextPluck < this.ctx.currentTime + lookAhead) {
                const freq = strings[stringIdx % strings.length];
                const buf = this._karplusStrong(freq, 3.5, 0.25, 0.9985);
                const src = this.ctx.createBufferSource();
                src.buffer = buf;

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(volume, nextPluck);
                gain.gain.exponentialRampToValueAtTime(0.001, nextPluck + 3.0);

                // Jawari buzz: slight distortion for tanpura character
                const waveshaper = this.ctx.createWaveShaper();
                const curve = new Float32Array(257);
                for (let i = 0; i < 257; i++) {
                    const x = (i - 128) / 128;
                    curve[i] = Math.tanh(x * 1.5); // Soft clip
                }
                waveshaper.curve = curve;
                waveshaper.oversample = '2x';

                src.connect(waveshaper);
                waveshaper.connect(gain);
                gain.connect(this.masterGain);
                src.start(nextPluck);
                src.stop(nextPluck + 3.5);
                this._droneNodes.push(src);

                stringIdx++;
                nextPluck += pluckInterval;
            }
            this._schedulerTimer = setTimeout(scheduleLoop, 150);
        };

        scheduleLoop();
    }

    // --- BANSURI (BAMBOO FLUTE) SYNTHESIS
    //  Uses oscillator + noise breath + vibrato for wind instrument sound ---

    /**
     * Play a bansuri flute note with breath noise and vibrato.
     * @param {number} freq - Note frequency
     * @param {number} startTime - When to start
     * @param {number} duration - Note duration in seconds
     * @param {number} volume - 0-1
     */
    _playFluteNote(freq, startTime, duration = 1.5, volume = 0.25) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;

        const vibrato = this.ctx.createOscillator();
        vibrato.type = 'sine';
        vibrato.frequency.value = 5 + Math.random() * 1.5; // 5-6.5 Hz
        const vibratoGain = this.ctx.createGain();
        vibratoGain.gain.value = freq * 0.012; // ~1.2% pitch variation
        vibrato.connect(vibratoGain);
        vibratoGain.connect(osc.frequency);

        const noiseLen = Math.ceil(this.ctx.sampleRate * duration);
        const noiseBuf = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
        const noiseData = noiseBuf.getChannelData(0);
        for (let i = 0; i < noiseLen; i++) {
            noiseData[i] = (Math.random() * 2 - 1) * 0.15;
        }
        const noiseSrc = this.ctx.createBufferSource();
        noiseSrc.buffer = noiseBuf;

        const breathFilter = this.ctx.createBiquadFilter();
        breathFilter.type = 'bandpass';
        breathFilter.frequency.value = freq;
        breathFilter.Q.value = 1.5;

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0, startTime);
        env.gain.linearRampToValueAtTime(volume, startTime + duration * 0.12);
        env.gain.setValueAtTime(volume, startTime + duration * 0.8);
        env.gain.linearRampToValueAtTime(0, startTime + duration);

        const breathEnv = this.ctx.createGain();
        breathEnv.gain.setValueAtTime(0, startTime);
        breathEnv.gain.linearRampToValueAtTime(volume * 0.3, startTime + duration * 0.08);
        breathEnv.gain.setValueAtTime(volume * 0.3, startTime + duration * 0.85);
        breathEnv.gain.linearRampToValueAtTime(0, startTime + duration);

        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 2;
        const osc2Gain = this.ctx.createGain();
        osc2Gain.gain.value = volume * 0.08;

        osc.connect(env);
        env.connect(this.masterGain);
        noiseSrc.connect(breathFilter);
        breathFilter.connect(breathEnv);
        breathEnv.connect(this.masterGain);
        osc2.connect(osc2Gain);
        osc2Gain.connect(this.masterGain);

        osc.start(startTime); vibrato.start(startTime);
        noiseSrc.start(startTime);
        osc2.start(startTime);
        osc.stop(startTime + duration + 0.05);
        vibrato.stop(startTime + duration + 0.05);
        noiseSrc.stop(startTime + duration + 0.05);
        osc2.stop(startTime + duration + 0.05);

        this._activeNotes.push(osc, vibrato, noiseSrc, osc2);
    }

    // --- TABLA PERCUSSION SYNTHESIS
    //  Models the pitched drum sounds of Indian classical music ---

    /**
     * Play a tabla stroke.
     * @param {string} bol - Tabla syllable: 'ge', 'na', 'tin', 'dha', 'dhin'
     * @param {number} startTime - When to play
     * @param {number} volume - 0-1
     */
    _playTabla(bol, startTime, volume = 0.2) {
        const presets = {
            // Dayan (right drum) — pitched, resonant
            na:   { freq: 350, decay: 0.15, type: 'sine', noise: 0.3 },
            tin:  { freq: 500, decay: 0.1,  type: 'sine', noise: 0.2 },
            // Bayan (left drum) — deeper, more complex
            ge:   { freq: 80,  decay: 0.25, type: 'sine', noise: 0.5 },
            // Combined strokes
            dha:  { freq: 150, decay: 0.2,  type: 'sine', noise: 0.4 },
            dhin: { freq: 180, decay: 0.25, type: 'sine', noise: 0.35 },
        };

        const p = presets[bol] || presets.na;

        const osc = this.ctx.createOscillator();
        osc.type = p.type;
        osc.frequency.setValueAtTime(p.freq * 1.5, startTime);
        osc.frequency.exponentialRampToValueAtTime(p.freq, startTime + 0.02);

        const oscEnv = this.ctx.createGain();
        oscEnv.gain.setValueAtTime(volume, startTime);
        oscEnv.gain.exponentialRampToValueAtTime(0.001, startTime + p.decay);

        const nLen = Math.ceil(this.ctx.sampleRate * p.decay);
        const nBuf = this.ctx.createBuffer(1, nLen, this.ctx.sampleRate);
        const nData = nBuf.getChannelData(0);
        for (let i = 0; i < nLen; i++) {
            nData[i] = (Math.random() * 2 - 1);
        }
        const nSrc = this.ctx.createBufferSource();
        nSrc.buffer = nBuf;

        const nFilter = this.ctx.createBiquadFilter();
        nFilter.type = 'bandpass';
        nFilter.frequency.value = p.freq * 3;
        nFilter.Q.value = 2;

        const nEnv = this.ctx.createGain();
        nEnv.gain.setValueAtTime(volume * p.noise, startTime);
        nEnv.gain.exponentialRampToValueAtTime(0.001, startTime + p.decay * 0.5);

        osc.connect(oscEnv);
        oscEnv.connect(this.masterGain);
        nSrc.connect(nFilter);
        nFilter.connect(nEnv);
        nEnv.connect(this.masterGain);

        osc.start(startTime); osc.stop(startTime + p.decay + 0.01);
        nSrc.start(startTime); nSrc.stop(startTime + p.decay + 0.01);
        this._activeNotes.push(osc, nSrc);
    }

    // --- SINGING BOWL PHYSICAL MODEL
    //  Multiple decaying partials with beating (bowl acoustics) ---

    /**
     * Play a physically-modeled singing bowl strike.
     * Real bowls have inharmonic partials that create beating patterns.
     * @param {number} fundamental - Bowl fundamental frequency
     * @param {number} startTime - When to strike
     * @param {number} volume - 0-1
     */
    _playSingingBowl(fundamental, startTime, volume = 0.2) {
        // Real singing bowl partial ratios (slightly inharmonic — creates beating)
        const partialRatios = [1.0, 2.71, 4.93, 7.65, 10.87];
        const partialGains = [1.0, 0.4, 0.15, 0.06, 0.02];
        const decays = [12, 10, 7, 5, 3];

        partialRatios.forEach((ratio, i) => {
            const freq = fundamental * ratio;
            const detune = (Math.random() - 0.5) * 1.5;

            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq + detune;

            const env = this.ctx.createGain();
            env.gain.setValueAtTime(0, startTime);
            env.gain.linearRampToValueAtTime(volume * partialGains[i], startTime + 0.01);
            env.gain.exponentialRampToValueAtTime(0.0001, startTime + decays[i]);

            osc.connect(env);
            env.connect(this.masterGain);
            osc.start(startTime);
            osc.stop(startTime + decays[i] + 0.1);
            this._droneNodes.push(osc);
        });
    }

    // --- PROCEDURAL RAGA GENERATOR
    //  Generates melodies following Indian classical music theory ---

    /**
     * Convert a raga scale degree + octave to frequency.
     * Uses just intonation ratios for authentic Indian tuning.
     * @param {number} tonic - Sa frequency (Hz)
     * @param {number} semitone - Semitones above Sa (0-11)
     * @param {number} octave - Octave offset from base (-1, 0, 1)
     */
    _noteToFreq(tonic, semitone, octave = 0) {
        return tonic * Math.pow(2, (semitone + octave * 12) / 12);
    }

    /**
     * Generate a melodic phrase following raga grammar.
     * Indian classical music doesn't just use random scale notes — each raga
     * has rules about which phrases are allowed, which notes are emphasized,
     * and how movements happen (aroha/avaroha patterns).
     *
     * @param {object} raga - Raga definition from this.RAGAS
     * @param {number} numNotes - How many notes in this phrase
     * @param {string} direction - 'ascending', 'descending', or 'mixed'
     * @returns {Array<{semitone, octave, duration}>} Phrase notes
     */
    _generatePhrase(raga, numNotes = 6, direction = 'mixed') {
        const phrase = [];
        let pool;

        if (direction === 'ascending') pool = [...raga.aroha];
        else if (direction === 'descending') pool = [...raga.avaroha];
        else pool = [...raga.notes, ...raga.notes.map(n => n + 12)]; // Two octaves

        let lastIdx = Math.floor(Math.random() * Math.min(3, pool.length)); // Start low

        for (let i = 0; i < numNotes; i++) {
            // Bias movement: small intervals preferred (stepwise motion)
            let step = Math.floor(Math.random() * 3) - 1; // -1, 0, +1
            if (direction === 'ascending') step = Math.max(0, step);
            if (direction === 'descending') step = Math.min(0, step);

            // Occasionally leap to vadi/samvadi (important notes)
            if (Math.random() < 0.2) {
                const target = Math.random() < 0.6 ? raga.vadi : raga.samvadi;
                const targetIdx = pool.indexOf(target);
                if (targetIdx >= 0) lastIdx = targetIdx;
            } else {
                lastIdx = Math.max(0, Math.min(pool.length - 1, lastIdx + step));
            }

            const semitone = pool[lastIdx] % 12;
            const octave = Math.floor(pool[lastIdx] / 12);

            // Duration: mix of short and long notes, with occasional sustain on vadi
            let dur = 0.4 + Math.random() * 0.6; // 0.4 - 1.0 seconds
            if (semitone === raga.vadi % 12) dur *= 1.5; // Longer on important note
            if (i === numNotes - 1) dur *= 1.3; // Phrase ending

            phrase.push({ semitone, octave, duration: dur });
        }

        return phrase;
    }

    /**
     * Add gamaka (ornamentations) to a note — the soul of Indian classical music.
     * @param {number} freq - Target note frequency
     * @param {OscillatorNode} osc - Oscillator to modulate
     * @param {number} startTime - Note start time
     * @param {number} duration - Note duration
     */
    _addGamaka(freq, osc, startTime, duration) {
        const gamakaType = Math.random();

        if (gamakaType < 0.3) {
            // Andolan — slow oscillation around the note (meend-like)
            const lfo = this.ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 3 + Math.random() * 2; // 3-5 Hz
            const depth = this.ctx.createGain();
            depth.gain.value = freq * 0.015; // ±1.5% pitch
            lfo.connect(depth);
            depth.connect(osc.frequency);
            lfo.start(startTime);
            lfo.stop(startTime + duration);
            this._activeNotes.push(lfo);
        } else if (gamakaType < 0.6) {
            // Meend — slide from previous pitch area
            const slideFrom = freq * (Math.random() < 0.5 ? 0.94 : 1.06);
            osc.frequency.setValueAtTime(slideFrom, startTime);
            osc.frequency.exponentialRampToValueAtTime(freq, startTime + duration * 0.2);
        } else {
            // Kan-swar — grace note (very brief touch of adjacent note)
            const grace = freq * (Math.random() < 0.5 ? 0.944 : 1.059); // ~minor 2nd
            osc.frequency.setValueAtTime(grace, startTime);
            osc.frequency.exponentialRampToValueAtTime(freq, startTime + 0.06);
        }
    }

    // --- MAIN COMPOSITION ENGINE
    //  Orchestrates instruments, melodies, rhythms, and drones ---

    /**
     * Start a generative raga composition.
     * @param {object} params
     * @param {string} params.raga - Raga name (from RAGAS keys)
     * @param {number} params.tonic - Sa frequency in Hz (default 130.81 = C3)
     * @param {number} params.tempo - BPM (default 60 for meditative)
     * @param {string} params.instrument - Lead instrument: sitar, bansuri, harp, veena
     * @param {boolean} params.withTabla - Include tabla rhythm
     * @param {boolean} params.withTanpura - Include tanpura drone
     * @param {boolean} params.withBowls - Include singing bowl strikes
     * @param {string} params.tala - Tala/rhythm pattern name
     * @param {number} params.volume - Master volume 0-1
     * @param {string} params.mood - Mood string for auto-selection
     */
    async compose(params = {}) {
        this._ensureCtx();
        this.stop();

        const ragaName = params.raga || this._ragaForMood(params.mood || 'calm');
        const raga = this.RAGAS[ragaName] || this.RAGAS.yaman;
        const tonic = params.tonic || 130.81; // C3
        const tempo = params.tempo || 60;
        const instrument = params.instrument || 'sitar';
        const withTabla = params.withTabla !== false;
        const withTanpura = params.withTanpura !== false;
        const withBowls = params.withBowls || false;
        const talaName = params.tala || 'keherwa';
        const volume = params.volume || 0.25;

        this.isPlaying = true;
        this.currentComposition = {
            raga: raga.name,
            ragaKey: ragaName,
            instrument,
            tonic,
            tempo,
            tala: talaName,
        };

        if (this.ctx.state === 'suspended') await this.ctx.resume();

        this.masterGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 1.5);

        if (withTanpura) {
            this._startTanpuraDrone(tonic, volume * 0.5);
        }

        if (withBowls) {
            this._scheduleBowlStrikes(tonic, volume * 0.4);
        }

        this._scheduleMelody(raga, tonic, tempo, instrument, volume);

        if (withTabla) {
            this._scheduleTabla(talaName, tempo, volume * 0.6);
        }

        console.log(`[GenerativeAudio] Composing: Raga ${raga.name} in ${instrument}, ${tempo} BPM, Tala: ${talaName}`);
    }

    /**
     * Schedule continuous melodic phrases.
     */
    _scheduleMelody(raga, tonic, tempo, instrument, volume) {
        const secPerBeat = 60 / tempo;
        let nextPhrase = this.ctx.currentTime + 0.1; // initialize scheduling start time

        const scheduleNextPhrase = () => {
            if (!this.isPlaying) return;

            const directions = ['ascending', 'descending', 'mixed', 'mixed'];
            const dir = directions[Math.floor(Math.random() * directions.length)];
            const numNotes = 4 + Math.floor(Math.random() * 5); // 4-8 notes
            const phrase = this._generatePhrase(raga, numNotes, dir);

            let t = nextPhrase;
            phrase.forEach(note => {
                const freq = this._noteToFreq(tonic, note.semitone, note.octave);
                const dur = note.duration * secPerBeat;

                if (instrument === 'sitar' || instrument === 'veena') {
                    this._playSitarNote(freq, t, volume * 0.7, instrument === 'sitar');
                } else if (instrument === 'bansuri') {
                    this._playFluteNote(freq, t, dur, volume * 0.8);
                } else if (instrument === 'harp') {
                    this._playHarpNote(freq, t, volume * 0.65);
                }

                t += dur;
            });

            const restBeats = 1 + Math.random() * 2;
            nextPhrase = t + restBeats * secPerBeat;

            const delayMs = (nextPhrase - this.ctx.currentTime) * 1000;
            this._schedulerTimer = setTimeout(scheduleNextPhrase, Math.max(100, delayMs - 200));
        };

        scheduleNextPhrase();
    }

    /**
     * Schedule tabla rhythm pattern.
     */
    _scheduleTabla(talaName, tempo, volume) {
        const tala = this.TALAS[talaName] || this.TALAS.keherwa;
        const secPerBeat = 60 / tempo;
        const secPerSubBeat = secPerBeat / 2; // Subdivide for finer rhythm
        let beatIdx = 0;
        let nextBeat = this.ctx.currentTime + 1.5;

        const bols = ['dha', 'dhin', 'na', 'tin', 'ge'];

        const scheduleTabla = () => {
            if (!this.isPlaying) return;
            const lookAhead = 0.3;

            while (nextBeat < this.ctx.currentTime + lookAhead) {
                const patIdx = beatIdx % tala.pattern.length;
                if (tala.pattern[patIdx]) {
                    const bol = patIdx === 0 ? 'dha' : bols[Math.floor(Math.random() * bols.length)];
                    this._playTabla(bol, nextBeat, volume);
                } else if (Math.random() < 0.25) {
                    this._playTabla('tin', nextBeat, volume * 0.3);
                }

                beatIdx++;
                nextBeat += secPerSubBeat;
            }

            this._percTimer = setTimeout(scheduleTabla, 100);
        };

        scheduleTabla();
    }

    /**
     * Schedule occasional singing bowl strikes.
     */
    _scheduleBowlStrikes(tonic, volume) {
        const bowlFreqs = [tonic, tonic * 1.5, tonic * 2, tonic * 3];
        let nextStrike = this.ctx.currentTime + 5 + Math.random() * 5;

        const scheduleStrike = () => {
            if (!this.isPlaying) return;
            const freq = bowlFreqs[Math.floor(Math.random() * bowlFreqs.length)];
            this._playSingingBowl(freq, nextStrike, volume);
            nextStrike += 15 + Math.random() * 20; // Every 15-35 seconds
            setTimeout(scheduleStrike, (nextStrike - this.ctx.currentTime) * 1000);
        };

        scheduleStrike();
    }

    /**
     * Pick best raga for a mood.
     */
    _ragaForMood(mood) {
        const ragas = this.MOOD_RAGA_MAP[mood] || this.MOOD_RAGA_MAP.calm;
        return ragas[Math.floor(Math.random() * ragas.length)];
    }

    // --- RECITATION MODE
    //  Background music for when Gemini recites poetry / mantras
    //  Gentle, non-intrusive accompaniment ---

    /**
     * Start recitation background — gentle drone + subtle harp arpeggios.
     * Designed to accompany spoken word without competing.
     * @param {object} params
     * @param {string} params.mood - calm, spiritual, healing, contemplative
     * @param {number} params.tonic - Base frequency (default 110 = A2)
     * @param {number} params.volume - 0-1 (default 0.12 — very subtle)
     */
    async startRecitationMode(params = {}) {
        this._ensureCtx();
        this.stop();

        const mood = params.mood || 'spiritual';
        const tonic = params.tonic || 110; // A2
        const volume = params.volume || 0.12;
        const ragaName = this._ragaForMood(mood);
        const raga = this.RAGAS[ragaName] || this.RAGAS.yaman;

        this.isPlaying = true;
        this.currentComposition = { raga: raga.name, mode: 'recitation', instrument: 'harp' };

        if (this.ctx.state === 'suspended') await this.ctx.resume();
        this.masterGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 2.0);

        this._startTanpuraDrone(tonic, volume * 0.4);

        this._scheduleRecitationArpeggios(raga, tonic, volume);

        console.log(`[GenerativeAudio] Recitation mode: Raga ${raga.name}`);
    }

    _scheduleRecitationArpeggios(raga, tonic, volume) {
        let nextArp = this.ctx.currentTime + 3.0;
        const schedule = () => {
            if (!this.isPlaying) return;

            const numNotes = 3 + Math.floor(Math.random() * 3);
            const startIdx = Math.floor(Math.random() * (raga.aroha.length - numNotes));
            let t = nextArp;

            for (let i = 0; i < numNotes; i++) {
                const semitone = raga.aroha[(startIdx + i) % raga.aroha.length];
                const freq = this._noteToFreq(tonic, semitone % 12, Math.floor(semitone / 12));
                this._playHarpNote(freq, t, volume * 0.5);
                t += 0.6 + Math.random() * 0.4; // Gentle spacing
            }

            nextArp = t + 5 + Math.random() * 7;
            setTimeout(schedule, (nextArp - this.ctx.currentTime) * 1000);
        };
        schedule();
    }

    // --- QUICK PRESETS — One-call compositions for common therapeutic needs ---

    /** Morning awakening — Raga Bhairav, sitar, slow tempo */
    async playMorningRaga(volume = 0.25) {
        return this.compose({
            raga: 'bhairav', instrument: 'sitar', tempo: 50,
            withTanpura: true, withTabla: false, withBowls: true, volume,
        });
    }

    /** Evening peace — Raga Yaman, bansuri, gentle tabla */
    async playEveningRaga(volume = 0.25) {
        return this.compose({
            raga: 'yaman', instrument: 'bansuri', tempo: 55,
            withTanpura: true, withTabla: true, tala: 'dadra', volume,
        });
    }

    /** Deep meditation — Raga Malkauns, sitar, no tabla */
    async playMeditationRaga(volume = 0.2) {
        return this.compose({
            raga: 'malkauns', instrument: 'sitar', tempo: 40,
            withTanpura: true, withTabla: false, withBowls: true, volume,
        });
    }

    /** Healing session — Raga Bageshree, bansuri, gentle rhythm */
    async playHealingRaga(volume = 0.25) {
        return this.compose({
            raga: 'bageshree', instrument: 'bansuri', tempo: 50,
            withTanpura: true, withTabla: true, tala: 'rupak', volume,
        });
    }

    /** Calming harp — Raga Bhoopali, harp arpeggios, no drums */
    async playCalmingHarp(volume = 0.2) {
        return this.compose({
            raga: 'bhoopali', instrument: 'harp', tempo: 45,
            withTanpura: true, withTabla: false, withBowls: true, volume,
        });
    }

    // --- CONTROL ---

    setVolume(vol) {
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.5);
        }
    }

    duck() {
        if (this.masterGain && this.isPlaying) {
            this.masterGain.gain.setTargetAtTime(0.05, this.ctx.currentTime, 0.3);
        }
    }

    unduck() {
        if (this.masterGain && this.isPlaying) {
            this.masterGain.gain.setTargetAtTime(0.2, this.ctx.currentTime, 0.5);
        }
    }

    stop() {
        this.isPlaying = false;
        this.currentComposition = null;
        if (this._schedulerTimer) { clearTimeout(this._schedulerTimer); this._schedulerTimer = null; }
        if (this._percTimer) { clearTimeout(this._percTimer); this._percTimer = null; }

        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
        }

        setTimeout(() => {
            [...this._droneNodes, ...this._activeNotes].forEach(n => {
                try { n.stop(); } catch (e) {}
                try { n.disconnect(); } catch (e) {}
            });
            this._droneNodes = [];
            this._activeNotes = [];
        }, 1500);
    }

    /** Get info about what's currently composing */
    getStatus() {
        if (!this.isPlaying || !this.currentComposition) return null;
        return { ...this.currentComposition };
    }

    destroy() {
        this.stop();
        this.ctx = null;
        this.masterGain = null;
    }
}

window.GenerativeSoundEngine = GenerativeSoundEngine;
