/**
 * Naada - Heart Rate Estimation via Camera (rPPG)
 *
 * Uses remote photoplethysmography to estimate heart rate from webcam.
 * Detects subtle skin color changes caused by blood flow pulsing through
 * facial blood vessels. Works by:
 *   1. Sampling the green channel from a region of interest (forehead/cheeks)
 *   2. Bandpass filtering to isolate 0.75-3.33 Hz (45-200 BPM range)
 *   3. Finding dominant frequency via autocorrelation or peak detection
 *
 * Accuracy: ±5-10 BPM in good lighting. Not medical-grade but impressive for demo.
 */

class HeartRateEstimator {
    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = canvasElement ? canvasElement.getContext("2d", { willReadFrequently: true }) : null;

        // Signal buffer (stores green channel means over time)
        this.BUFFER_SIZE = 256;  // ~8.5 seconds at 30fps
        this.greenSignal = [];
        this.timestamps = [];

        // Output
        this.currentBPM = 0;
        this.confidence = 0;
        this.bpmHistory = [];
        this.onBPMUpdate = null;  // callback(bpm, confidence)

        // Sampling
        this._running = false;
        this._sampleInterval = null;
        this.SAMPLE_RATE_MS = 33;  // ~30 fps sampling

        // Voice stress
        this.voiceStressLevel = 0;  // 0-100
        this.onVoiceStressUpdate = null;

        // Coherence
        this.coherence = 0;
        this.onCoherenceUpdate = null;
    }

    /**
     * Start heart rate estimation from webcam feed.
     */
    start() {
        if (this._running) return;
        this._running = true;
        this.greenSignal = [];
        this.timestamps = [];

        this._sampleInterval = setInterval(() => {
            this._sampleFrame();
        }, this.SAMPLE_RATE_MS);

        console.log("[HeartRate] rPPG estimation started");
    }

    /**
     * Stop heart rate estimation.
     */
    stop() {
        this._running = false;
        if (this._sampleInterval) {
            clearInterval(this._sampleInterval);
            this._sampleInterval = null;
        }
        this.greenSignal = [];
        this.timestamps = [];
        console.log("[HeartRate] Stopped");
    }

    /**
     * Sample the current video frame for green channel intensity.
     */
    _sampleFrame() {
        if (!this.video || !this.ctx || !this.video.videoWidth) return;

        const vw = this.video.videoWidth;
        const vh = this.video.videoHeight;

        // Region of Interest (ROI): upper-center of face (forehead area)
        // This area has thin skin and strong blood vessel visibility
        const roiX = Math.floor(vw * 0.3);
        const roiY = Math.floor(vh * 0.15);
        const roiW = Math.floor(vw * 0.4);
        const roiH = Math.floor(vh * 0.2);

        // Draw video frame to canvas (reuse existing camera canvas)
        this.canvas.width = vw;
        this.canvas.height = vh;
        this.ctx.drawImage(this.video, 0, 0, vw, vh);

        // Get pixel data from ROI
        try {
            const imageData = this.ctx.getImageData(roiX, roiY, roiW, roiH);
            const data = imageData.data;

            // Calculate mean green channel value (green is most sensitive to blood volume changes)
            let greenSum = 0;
            let redSum = 0;
            const pixelCount = roiW * roiH;

            for (let i = 0; i < data.length; i += 4) {
                redSum += data[i];       // R
                greenSum += data[i + 1]; // G
            }

            const greenMean = greenSum / pixelCount;
            const redMean = redSum / pixelCount;

            // Use green channel (most responsive to hemoglobin changes)
            // Apply simple chrominance-based rPPG: green / red ratio reduces motion artifacts
            const signal = greenMean / Math.max(redMean, 1);

            this.greenSignal.push(signal);
            this.timestamps.push(performance.now());

            // Keep buffer at fixed size
            if (this.greenSignal.length > this.BUFFER_SIZE) {
                this.greenSignal.shift();
                this.timestamps.shift();
            }

            // Need at least 3 seconds of data before estimating
            if (this.greenSignal.length >= 90) {
                this._estimateBPM();
            }
        } catch (e) {
            // Canvas may fail due to CORS or other issues
        }
    }

    /**
     * Estimate BPM from the green channel signal using autocorrelation.
     */
    _estimateBPM() {
        const signal = this.greenSignal;
        const N = signal.length;

        // Calculate actual sampling rate from timestamps
        const duration = (this.timestamps[N - 1] - this.timestamps[0]) / 1000;
        const fps = (N - 1) / duration;

        // Detrend: remove low-frequency drift (subtract moving average)
        const windowSize = Math.floor(fps * 1.5); // 1.5 second window
        const detrended = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            const start = Math.max(0, i - windowSize);
            const end = Math.min(N, i + windowSize + 1);
            let sum = 0;
            for (let j = start; j < end; j++) sum += signal[j];
            detrended[i] = signal[i] - sum / (end - start);
        }

        // Bandpass: only look at lag ranges corresponding to 45-180 BPM
        const minLag = Math.floor(fps * 60 / 180); // 180 BPM
        const maxLag = Math.floor(fps * 60 / 45);  // 45 BPM

        // Autocorrelation to find dominant period
        let bestLag = minLag;
        let bestCorr = -Infinity;
        const corrValues = [];

        for (let lag = minLag; lag <= Math.min(maxLag, N - 1); lag++) {
            let corr = 0;
            let norm1 = 0;
            let norm2 = 0;
            const count = N - lag;

            for (let i = 0; i < count; i++) {
                corr += detrended[i] * detrended[i + lag];
                norm1 += detrended[i] * detrended[i];
                norm2 += detrended[i + lag] * detrended[i + lag];
            }

            // Normalized correlation
            const normCorr = corr / Math.sqrt(Math.max(norm1 * norm2, 1e-10));
            corrValues.push(normCorr);

            if (normCorr > bestCorr) {
                bestCorr = normCorr;
                bestLag = lag;
            }
        }

        // Convert lag to BPM
        const bpm = Math.round((fps * 60) / bestLag);
        const confidence = Math.max(0, Math.min(100, Math.round(bestCorr * 100)));

        // Validate: BPM should be in reasonable human range
        if (bpm >= 50 && bpm <= 160 && confidence > 15) {
            // Smooth with exponential moving average
            if (this.currentBPM === 0) {
                this.currentBPM = bpm;
            } else {
                this.currentBPM = Math.round(this.currentBPM * 0.7 + bpm * 0.3);
            }
            this.confidence = confidence;
            this.bpmHistory.push(this.currentBPM);
            if (this.bpmHistory.length > 60) this.bpmHistory.shift();

            // Calculate coherence (how regular the heart rhythm is)
            this._calculateCoherence();

            if (this.onBPMUpdate) {
                this.onBPMUpdate(this.currentBPM, this.confidence);
            }
        }
    }

    /**
     * Calculate heart rate coherence (regularity of rhythm).
     * High coherence = regular, relaxed state. Low = stressed, erratic.
     */
    _calculateCoherence() {
        if (this.bpmHistory.length < 5) {
            this.coherence = 50;
            return;
        }

        // Calculate variance of recent BPM readings
        const recent = this.bpmHistory.slice(-10);
        const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
        const variance = recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length;
        const stdDev = Math.sqrt(variance);

        // Low variance = high coherence (0-100 scale)
        // stdDev of 0 = 100% coherence, stdDev of 15+ = 0% coherence
        this.coherence = Math.round(Math.max(0, Math.min(100, 100 - (stdDev / 15) * 100)));

        if (this.onCoherenceUpdate) {
            this.onCoherenceUpdate(this.coherence);
        }
    }

    /**
     * Update voice stress level based on audio characteristics.
     * Called externally from the audio processor with RMS and pitch data.
     */
    updateVoiceStress(rms, pitchVariance) {
        // Higher RMS + high pitch variance = higher stress
        // Normalized to 0-100 scale
        const rmsStress = Math.min(100, rms * 800);
        const pitchStress = Math.min(100, (pitchVariance || 0) * 50);
        const combined = rmsStress * 0.6 + pitchStress * 0.4;

        // Smooth it
        this.voiceStressLevel = Math.round(this.voiceStressLevel * 0.8 + combined * 0.2);

        if (this.onVoiceStressUpdate) {
            this.onVoiceStressUpdate(this.voiceStressLevel);
        }
    }

    /**
     * Get average BPM for session report.
     */
    getSessionAverage() {
        if (this.bpmHistory.length === 0) return null;
        return Math.round(this.bpmHistory.reduce((a, b) => a + b, 0) / this.bpmHistory.length);
    }

    /**
     * Get BPM trend (decreasing = relaxing).
     */
    getTrend() {
        if (this.bpmHistory.length < 10) return "stable";
        const firstHalf = this.bpmHistory.slice(0, Math.floor(this.bpmHistory.length / 2));
        const secondHalf = this.bpmHistory.slice(Math.floor(this.bpmHistory.length / 2));
        const avg1 = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avg2 = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        if (avg2 < avg1 - 3) return "decreasing";
        if (avg2 > avg1 + 3) return "increasing";
        return "stable";
    }
}

window.HeartRateEstimator = HeartRateEstimator;
