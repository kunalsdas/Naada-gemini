/**
 * Naada - Audio Visualizer & Particle System
 * Real-time radial frequency bars + audio-reactive floating particles.
 * Uses Web Audio API AnalyserNode data from TherapyAudioEngine.
 */

const MOOD_COLORS = {
    neutral:  ["#1e1b4b", "#a78bfa"],
    stressed: ["#7f1d1d", "#ef4444"],
    anxious:  ["#78350f", "#f59e0b"],
    sad:      ["#1e3a5f", "#60a5fa"],
    calm:     ["#064e3b", "#06b6d4"],
    relaxed:  ["#0d4f4f", "#10b981"],
    happy:    ["#3b0764", "#c084fc"],
    focused:  ["#1e1b4b", "#818cf8"],
    peaceful: ["#042f2e", "#10b981"],
    tired:    ["#1f2937", "#9ca3af"],
    angry:    ["#450a0a", "#dc2626"],
};

/* ============================================
   AudioVisualizer - Radial frequency bars
   ============================================ */

class AudioVisualizer {
    constructor(canvasId, therapyEngine) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.c = this.canvas.getContext("2d");
        this.engine = therapyEngine;
        this.animId = null;
        this.mood = "neutral";
    }

    start() {
        if (!this.canvas) return;
        this._resize();
        this._loop();
        this._resizeHandler = () => this._resize();
        window.addEventListener("resize", this._resizeHandler);
    }

    stop() {
        if (this.animId) cancelAnimationFrame(this.animId);
        this.animId = null;
        if (this.c) this.c.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this._resizeHandler) window.removeEventListener("resize", this._resizeHandler);
    }

    setMood(m) { this.mood = m || "neutral"; }

    _resize() {
        const r = this.canvas.parentElement.getBoundingClientRect();
        const d = window.devicePixelRatio || 1;
        this.canvas.width = r.width * d;
        this.canvas.height = r.height * d;
        this.c.scale(d, d);
        this.w = r.width;
        this.h = r.height;
    }

    _loop() {
        this.animId = requestAnimationFrame(() => this._loop());
        const freq = this.engine.getFrequencyData();
        this.c.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!freq) return;

        const cx = this.w / 2;
        const cy = this.h / 2;
        const inner = Math.min(this.w, this.h) * 0.12;
        const maxBar = Math.min(this.w, this.h) * 0.18;
        const count = 64;
        const slice = (2 * Math.PI) / count;
        const [c1, c2] = MOOD_COLORS[this.mood] || MOOD_COLORS.neutral;

        for (let i = 0; i < count; i++) {
            const amp = freq[i] / 255;
            const bar = amp * maxBar + 2;
            const a = i * slice - Math.PI / 2;
            const cos = Math.cos(a), sin = Math.sin(a);

            this.c.beginPath();
            this.c.moveTo(cx + cos * inner, cy + sin * inner);
            this.c.lineTo(cx + cos * (inner + bar), cy + sin * (inner + bar));
            this.c.strokeStyle = _lerp(c1, c2, amp);
            this.c.lineWidth = Math.max(1.5, (this.w / 200));
            this.c.lineCap = "round";
            this.c.globalAlpha = 0.35 + amp * 0.65;
            this.c.stroke();
        }

        // Subtle glow ring at inner radius
        const avgAmp = Array.from(freq.slice(0, 32)).reduce((s, v) => s + v, 0) / (32 * 255);
        this.c.beginPath();
        this.c.arc(cx, cy, inner - 2, 0, Math.PI * 2);
        this.c.strokeStyle = c2;
        this.c.lineWidth = 1.5 + avgAmp * 3;
        this.c.globalAlpha = 0.15 + avgAmp * 0.4;
        this.c.stroke();
        this.c.globalAlpha = 1;
    }
}

/* ============================================
   ParticleSystem - Audio-reactive particles
   ============================================ */

class ParticleSystem {
    constructor(canvasId, therapyEngine) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.c = this.canvas.getContext("2d");
        this.engine = therapyEngine;
        this.particles = [];
        this.maxP = 45;
        this.animId = null;
        this.mood = "neutral";
    }

    start() {
        if (!this.canvas) return;
        this._resize();
        this._init();
        this._loop();
        this._resizeHandler = () => this._resize();
        window.addEventListener("resize", this._resizeHandler);
    }

    stop() {
        if (this.animId) cancelAnimationFrame(this.animId);
        this.animId = null;
        if (this.c) this.c.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this._resizeHandler) window.removeEventListener("resize", this._resizeHandler);
    }

    setMood(m) { this.mood = m || "neutral"; }

    _resize() {
        const r = this.canvas.parentElement.getBoundingClientRect();
        const d = window.devicePixelRatio || 1;
        this.canvas.width = r.width * d;
        this.canvas.height = r.height * d;
        this.c.scale(d, d);
        this.w = r.width;
        this.h = r.height;
    }

    _init() {
        this.particles = [];
        for (let i = 0; i < this.maxP; i++) {
            this.particles.push({
                x: Math.random() * this.w,
                y: Math.random() * this.h,
                r: 1 + Math.random() * 2.5,
                speed: 0.15 + Math.random() * 0.4,
                angle: Math.random() * Math.PI * 2,
                opacity: 0.08 + Math.random() * 0.22,
                drift: (Math.random() - 0.5) * 0.002,
            });
        }
    }

    _loop() {
        this.animId = requestAnimationFrame(() => this._loop());
        this.c.clearRect(0, 0, this.canvas.width, this.canvas.height);

        let amp = 0;
        const td = this.engine.getTimeDomainData();
        if (td) {
            let sum = 0;
            for (let i = 0; i < td.length; i++) sum += Math.abs(td[i] - 128);
            amp = sum / td.length / 128;
        }

        const [, color] = MOOD_COLORS[this.mood] || MOOD_COLORS.neutral;

        for (const p of this.particles) {
            const sm = 1 + amp * 2.5;
            p.angle += p.drift;
            p.x += Math.cos(p.angle) * p.speed * sm;
            p.y += Math.sin(p.angle) * p.speed * sm;

            if (p.x < -10) p.x = this.w + 10;
            if (p.x > this.w + 10) p.x = -10;
            if (p.y < -10) p.y = this.h + 10;
            if (p.y > this.h + 10) p.y = -10;

            const radius = p.r * (1 + amp * 1.8);

            this.c.beginPath();
            this.c.arc(p.x, p.y, radius, 0, Math.PI * 2);
            this.c.fillStyle = color;
            this.c.globalAlpha = p.opacity + amp * 0.3;
            this.c.fill();
        }
        this.c.globalAlpha = 1;
    }
}

/* ============================================
   Utility: Hex color interpolation
   ============================================ */

function _lerp(hex1, hex2, t) {
    const r1 = parseInt(hex1.slice(1, 3), 16), g1 = parseInt(hex1.slice(3, 5), 16), b1 = parseInt(hex1.slice(5, 7), 16);
    const r2 = parseInt(hex2.slice(1, 3), 16), g2 = parseInt(hex2.slice(3, 5), 16), b2 = parseInt(hex2.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * t), g = Math.round(g1 + (g2 - g1) * t), b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r},${g},${b})`;
}


/* ============================================
   Emotion Spectrum Radar
   6-axis radar chart showing emotional state
   ============================================ */

class EmotionRadar {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) { this._noop = true; return; }
        this.c = this.canvas.getContext("2d");
        this.axes = ["Stress", "Calm", "Joy", "Sadness", "Focus", "Energy"];
        this.numAxes = 6;
        // Current and target values (0-1 range for each axis)
        this.current = [0.2, 0.3, 0.3, 0.1, 0.3, 0.3];
        this.target  = [0.2, 0.3, 0.3, 0.1, 0.3, 0.3];
        this.animId = null;
        this.fillColor = "167, 139, 250"; // RGB for fill (default accent)
        this.strokeColor = "#a78bfa";

        // Emotion → axis values mapping: [Stress, Calm, Joy, Sadness, Focus, Energy]
        this.emotionMap = {
            neutral:  [0.2, 0.5, 0.3, 0.1, 0.4, 0.4],
            stressed: [0.9, 0.1, 0.1, 0.2, 0.3, 0.6],
            anxious:  [0.8, 0.1, 0.1, 0.3, 0.2, 0.5],
            sad:      [0.3, 0.2, 0.1, 0.9, 0.2, 0.1],
            calm:     [0.1, 0.9, 0.5, 0.1, 0.5, 0.3],
            relaxed:  [0.1, 0.8, 0.6, 0.1, 0.4, 0.3],
            happy:    [0.1, 0.6, 0.9, 0.0, 0.5, 0.7],
            focused:  [0.3, 0.5, 0.4, 0.1, 0.9, 0.5],
            peaceful: [0.0, 0.9, 0.6, 0.0, 0.4, 0.2],
            tired:    [0.4, 0.3, 0.1, 0.4, 0.2, 0.1],
            angry:    [0.9, 0.0, 0.0, 0.2, 0.3, 0.8],
        };
    }

    setEmotion(emotion) {
        if (this._noop) return;
        this.target = this.emotionMap[emotion] || this.emotionMap.neutral;
        const colors = MOOD_COLORS[emotion] || MOOD_COLORS.neutral;
        this.strokeColor = colors[1];
        // Extract RGB from hex for semi-transparent fill
        const hex = colors[1];
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        this.fillColor = `${r}, ${g}, ${b}`;
    }

    start() {
        if (this._noop) return;
        this._resize();
        this._loop();
        this._resizeHandler = () => this._resize();
        window.addEventListener("resize", this._resizeHandler);
    }

    stop() {
        if (this.animId) cancelAnimationFrame(this.animId);
        this.animId = null;
        if (this._resizeHandler) window.removeEventListener("resize", this._resizeHandler);
    }

    _resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const size = Math.min(rect.width, rect.height) || 160;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = size * dpr;
        this.canvas.height = size * dpr;
        this.c.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.size = size;
        this.cx = size / 2;
        this.cy = size / 2;
        this.maxR = size * 0.38; // max radius of radar
    }

    _loop() {
        this.animId = requestAnimationFrame(() => this._loop());
        // Smooth lerp current toward target
        for (let i = 0; i < this.numAxes; i++) {
            this.current[i] += (this.target[i] - this.current[i]) * 0.04;
        }
        this._draw();
    }

    _draw() {
        const { c, cx, cy, maxR, numAxes, size } = this;
        c.clearRect(0, 0, size, size);

        const angleStep = (Math.PI * 2) / numAxes;
        const startAngle = -Math.PI / 2; // top

        // Draw concentric reference hexagons (background grid)
        for (const fraction of [0.33, 0.66, 1.0]) {
            c.beginPath();
            for (let i = 0; i < numAxes; i++) {
                const angle = startAngle + i * angleStep;
                const x = cx + Math.cos(angle) * maxR * fraction;
                const y = cy + Math.sin(angle) * maxR * fraction;
                if (i === 0) c.moveTo(x, y);
                else c.lineTo(x, y);
            }
            c.closePath();
            c.strokeStyle = `rgba(255, 255, 255, ${fraction < 1 ? 0.06 : 0.12})`;
            c.lineWidth = 0.5;
            c.stroke();
        }

        // Draw axis lines
        for (let i = 0; i < numAxes; i++) {
            const angle = startAngle + i * angleStep;
            c.beginPath();
            c.moveTo(cx, cy);
            c.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
            c.strokeStyle = "rgba(255, 255, 255, 0.08)";
            c.lineWidth = 0.5;
            c.stroke();
        }

        // Draw filled data polygon
        c.beginPath();
        for (let i = 0; i < numAxes; i++) {
            const angle = startAngle + i * angleStep;
            const val = Math.max(0.05, this.current[i]); // minimum so shape is always visible
            const x = cx + Math.cos(angle) * maxR * val;
            const y = cy + Math.sin(angle) * maxR * val;
            if (i === 0) c.moveTo(x, y);
            else c.lineTo(x, y);
        }
        c.closePath();
        c.fillStyle = `rgba(${this.fillColor}, 0.25)`;
        c.fill();
        c.strokeStyle = this.strokeColor;
        c.lineWidth = 1.5;
        c.stroke();

        // Draw vertex dots
        for (let i = 0; i < numAxes; i++) {
            const angle = startAngle + i * angleStep;
            const val = Math.max(0.05, this.current[i]);
            const x = cx + Math.cos(angle) * maxR * val;
            const y = cy + Math.sin(angle) * maxR * val;
            c.beginPath();
            c.arc(x, y, 2.5, 0, Math.PI * 2);
            c.fillStyle = this.strokeColor;
            c.fill();
        }

        // Draw axis labels
        c.font = "9px -apple-system, BlinkMacSystemFont, sans-serif";
        c.fillStyle = "rgba(255, 255, 255, 0.45)";
        c.textAlign = "center";
        c.textBaseline = "middle";
        for (let i = 0; i < numAxes; i++) {
            const angle = startAngle + i * angleStep;
            const labelR = maxR + 14;
            const x = cx + Math.cos(angle) * labelR;
            const y = cy + Math.sin(angle) * labelR;
            c.fillText(this.axes[i], x, y);
        }
    }
}

window.EmotionRadar = EmotionRadar;
