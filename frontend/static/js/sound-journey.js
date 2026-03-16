/**
 * Naada - Sound Journey Timeline
 *
 * A real-time scrolling timeline that visualizes the session progression:
 * - Colored segments for each therapy type
 * - Mood markers at emotional transitions
 * - Wellness score line graph overlay
 * - Time markers every 30 seconds
 */

class SoundJourneyTimeline {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas ? this.canvas.getContext("2d") : null;
        this._running = false;
        this._animId = null;

        // Timeline data
        this.segments = [];         // {type, startTime, endTime, color}
        this.moodMarkers = [];      // {time, emotion, color}
        this.wellnessPoints = [];   // {time, score}

        // Current state
        this._startTime = 0;
        this._currentTherapy = null;

        // Colors for therapy types
        this.THERAPY_COLORS = {
            tibetan_bowls: "#7c3aed",
            indian_raga: "#f59e0b",
            delta_waves: "#1e3a8a",
            binaural_focus: "#3b82f6",
            om_drone: "#eab308",
            solfeggio: "#c084fc",
            nature_rain: "#10b981",
            ocean_waves: "#06b6d4",
            theta_meditation: "#581c87",
            chakra_tune: "#ec4899",
            mix: "#a78bfa",
            sos: "#ef4444",
        };

        this.MOOD_COLORS = {
            neutral: "#6b7280", stressed: "#ef4444", anxious: "#f59e0b",
            sad: "#60a5fa", calm: "#06b6d4", relaxed: "#10b981",
            happy: "#c084fc", focused: "#818cf8", peaceful: "#10b981",
            tired: "#9ca3af", angry: "#dc2626",
        };
    }

    /**
     * Start the timeline.
     */
    start() {
        if (this._running) return;
        this._running = true;
        this._startTime = Date.now();
        this.segments = [];
        this.moodMarkers = [];
        this.wellnessPoints = [];
        this._resize();
        this._draw();
        console.log("[Journey] Timeline started");
    }

    /**
     * Stop the timeline.
     */
    stop() {
        this._running = false;
        if (this._animId) {
            cancelAnimationFrame(this._animId);
            this._animId = null;
        }
    }

    /**
     * Record a therapy starting.
     */
    addTherapy(type) {
        const now = Date.now();
        // End previous segment
        if (this.segments.length > 0) {
            const last = this.segments[this.segments.length - 1];
            if (!last.endTime) last.endTime = now;
        }
        this.segments.push({
            type,
            startTime: now,
            endTime: null,
            color: this.THERAPY_COLORS[type] || "#a78bfa",
        });
        this._currentTherapy = type;
    }

    /**
     * End current therapy segment.
     */
    endTherapy() {
        if (this.segments.length > 0) {
            const last = this.segments[this.segments.length - 1];
            if (!last.endTime) last.endTime = Date.now();
        }
        this._currentTherapy = null;
    }

    /**
     * Add a mood marker.
     */
    addMoodMarker(emotion) {
        this.moodMarkers.push({
            time: Date.now(),
            emotion,
            color: this.MOOD_COLORS[emotion] || "#a78bfa",
        });
    }

    /**
     * Add a wellness score point.
     */
    addWellnessPoint(score) {
        this.wellnessPoints.push({
            time: Date.now(),
            score,
        });
    }

    /**
     * Get elapsed time string.
     */
    getElapsedStr() {
        const elapsed = Math.floor((Date.now() - this._startTime) / 1000);
        const min = Math.floor(elapsed / 60);
        const sec = elapsed % 60;
        return `${min}:${String(sec).padStart(2, "0")}`;
    }

    _resize() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width * (window.devicePixelRatio || 1);
        this.canvas.height = rect.height * (window.devicePixelRatio || 1);
        this.canvas.style.width = rect.width + "px";
        this.canvas.style.height = rect.height + "px";
    }

    _draw() {
        if (!this._running || !this.ctx) return;

        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;
        const dpr = window.devicePixelRatio || 1;

        ctx.clearRect(0, 0, W, H);

        const now = Date.now();
        const elapsed = now - this._startTime;
        const VISIBLE_DURATION = Math.max(30000, elapsed); // Show at least 30s, then expand
        const pixelsPerMs = W / VISIBLE_DURATION;

        // Draw therapy segments
        for (const seg of this.segments) {
            const x1 = (seg.startTime - this._startTime) * pixelsPerMs;
            const x2 = ((seg.endTime || now) - this._startTime) * pixelsPerMs;
            const segW = Math.max(2, x2 - x1);

            ctx.fillStyle = seg.color + "60"; // semi-transparent
            ctx.fillRect(x1, 0, segW, H);

            // Top accent line
            ctx.fillStyle = seg.color;
            ctx.fillRect(x1, 0, segW, 3 * dpr);
        }

        // Draw time markers every 30 seconds
        const interval = 30000; // 30s
        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        ctx.font = `${9 * dpr}px Inter, sans-serif`;
        for (let t = interval; t < elapsed; t += interval) {
            const x = t * pixelsPerMs;
            ctx.fillRect(x, 0, 1, H);
            const mins = Math.floor(t / 60000);
            const secs = Math.floor((t % 60000) / 1000);
            ctx.fillText(`${mins}:${String(secs).padStart(2, "0")}`, x + 3, H - 4 * dpr);
        }

        // Draw wellness score line
        if (this.wellnessPoints.length >= 2) {
            ctx.beginPath();
            ctx.strokeStyle = "#10b981";
            ctx.lineWidth = 2 * dpr;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";

            for (let i = 0; i < this.wellnessPoints.length; i++) {
                const p = this.wellnessPoints[i];
                const x = (p.time - this._startTime) * pixelsPerMs;
                const y = H - (p.score / 100) * H; // inverted: low score = bottom (good)
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Score dots
            for (const p of this.wellnessPoints) {
                const x = (p.time - this._startTime) * pixelsPerMs;
                const y = H - (p.score / 100) * H;
                ctx.beginPath();
                ctx.arc(x, y, 3 * dpr, 0, Math.PI * 2);
                ctx.fillStyle = "#10b981";
                ctx.fill();
            }
        }

        // Draw mood markers
        for (const marker of this.moodMarkers) {
            const x = (marker.time - this._startTime) * pixelsPerMs;
            // Diamond marker
            ctx.save();
            ctx.translate(x, H * 0.7);
            ctx.rotate(Math.PI / 4);
            ctx.fillStyle = marker.color;
            const size = 4 * dpr;
            ctx.fillRect(-size / 2, -size / 2, size, size);
            ctx.restore();
        }

        // Progress indicator (current time)
        const progressX = elapsed * pixelsPerMs;
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.fillRect(progressX - 1, 0, 2, H);

        this._animId = requestAnimationFrame(() => this._draw());
    }
}

window.SoundJourneyTimeline = SoundJourneyTimeline;
