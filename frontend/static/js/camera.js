/**
 * Naada - Camera Handler
 * Manages camera stream and frame capture for mood vision.
 */

class CameraHandler {
    constructor() {
        this.videoElement = null;
        this.canvasElement = null;
        this.stream = null;
        this.isActive = false;
        this.captureInterval = null;
        this.autoCaptureEnabled = false;

        // Frame settings
        this.frameWidth = 640;
        this.frameHeight = 480;
        this.frameQuality = 0.7; // JPEG quality (0-1)

        // Callbacks
        this.onFrameCaptured = null; // called with {data: base64, mimeType: string}
    }

    /**
     * Initialize camera with video and canvas elements.
     */
    async init(videoElementId, canvasElementId) {
        this.videoElement = document.getElementById(videoElementId);
        this.canvasElement = document.getElementById(canvasElementId);

        if (!this.videoElement || !this.canvasElement) {
            throw new Error("Video or canvas element not found");
        }

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment", // Prefer rear camera for documents
                    width: { ideal: this.frameWidth },
                    height: { ideal: this.frameHeight },
                },
            });

            this.videoElement.srcObject = this.stream;
            await this.videoElement.play();
            this.isActive = true;

            // Set canvas dimensions to match video
            this.canvasElement.width = this.frameWidth;
            this.canvasElement.height = this.frameHeight;

            console.log("[Camera] Initialized");
            return true;
        } catch (err) {
            console.error("[Camera] Init failed:", err);
            throw new Error("Camera access denied. Please allow camera access.");
        }
    }

    /**
     * Capture a single frame from the camera and return as base64 JPEG.
     */
    captureFrame() {
        if (!this.isActive || !this.videoElement || !this.canvasElement) {
            console.warn("[Camera] Cannot capture - not active");
            return null;
        }

        const ctx = this.canvasElement.getContext("2d");

        // Draw current video frame to canvas
        ctx.drawImage(
            this.videoElement,
            0, 0,
            this.canvasElement.width,
            this.canvasElement.height
        );

        // Convert to JPEG base64
        const dataUrl = this.canvasElement.toDataURL("image/jpeg", this.frameQuality);
        const base64Data = dataUrl.split(",")[1]; // Remove "data:image/jpeg;base64," prefix

        const frameData = {
            data: base64Data,
            mimeType: "image/jpeg",
        };

        if (this.onFrameCaptured) {
            this.onFrameCaptured(frameData);
        }

        return frameData;
    }

    /**
     * Start automatic frame capture at given interval (for continuous document reading).
     * @param {number} intervalMs - Milliseconds between captures (default: 2000)
     */
    startAutoCapture(intervalMs = 2000) {
        if (this.autoCaptureEnabled) return;

        this.autoCaptureEnabled = true;
        this.captureInterval = setInterval(() => {
            if (this.isActive) {
                this.captureFrame();
            }
        }, intervalMs);

        console.log(`[Camera] Auto-capture started (every ${intervalMs}ms)`);
    }

    /**
     * Stop automatic frame capture.
     */
    stopAutoCapture() {
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }
        this.autoCaptureEnabled = false;
        console.log("[Camera] Auto-capture stopped");
    }

    /**
     * Toggle camera on/off.
     */
    toggle() {
        if (this.isActive) {
            this.pause();
        } else {
            this.resume();
        }
        return this.isActive;
    }

    /**
     * Pause the camera stream.
     */
    pause() {
        if (this.stream) {
            this.stream.getVideoTracks().forEach((track) => {
                track.enabled = false;
            });
        }
        this.stopAutoCapture();
        this.isActive = false;
        console.log("[Camera] Paused");
    }

    /**
     * Resume the camera stream.
     */
    resume() {
        if (this.stream) {
            this.stream.getVideoTracks().forEach((track) => {
                track.enabled = true;
            });
        }
        this.isActive = true;
        console.log("[Camera] Resumed");
    }

    /**
     * Switch between front and rear cameras.
     */
    async switchCamera() {
        const currentTrack = this.stream?.getVideoTracks()[0];
        if (!currentTrack) return;

        const currentFacingMode = currentTrack.getSettings().facingMode;
        const newFacingMode = currentFacingMode === "environment" ? "user" : "environment";

        // Stop current stream
        this.stream.getTracks().forEach((track) => track.stop());

        // Start new stream
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: newFacingMode,
                    width: { ideal: this.frameWidth },
                    height: { ideal: this.frameHeight },
                },
            });

            this.videoElement.srcObject = this.stream;
            await this.videoElement.play();
            console.log(`[Camera] Switched to ${newFacingMode}`);
        } catch (err) {
            console.error("[Camera] Switch failed:", err);
        }
    }

    /**
     * Clean up all resources.
     */
    destroy() {
        this.stopAutoCapture();

        if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop());
            this.stream = null;
        }

        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }

        this.isActive = false;
        console.log("[Camera] Destroyed");
    }
}

// Export
window.CameraHandler = CameraHandler;
