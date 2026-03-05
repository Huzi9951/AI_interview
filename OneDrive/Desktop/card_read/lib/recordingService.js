// =============================================
// Recording Service — Camera + Mic capture
// No screen sharing required. Works on all browsers.
// =============================================

let mediaRecorder = null;
let recordedChunks = [];
let recordingStream = null;

/**
 * Check if all required permissions/APIs are available.
 * Returns { camera: bool, microphone: bool, allPassed: bool }
 * No screen permission needed — we record camera+mic directly.
 */
export async function checkPermissions() {
    const result = { camera: false, microphone: false, screen: true, allPassed: false };

    // Check camera
    try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        camStream.getTracks().forEach(t => t.stop());
        result.camera = true;
    } catch (e) {
        console.warn('Camera permission denied:', e.message);
    }

    // Check microphone
    try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStream.getTracks().forEach(t => t.stop());
        result.microphone = true;
    } catch (e) {
        console.warn('Microphone permission denied:', e.message);
    }

    // screen is always true since we don't need screen share
    result.allPassed = result.camera && result.microphone;
    return result;
}

/**
 * Start recording camera + microphone.
 * Accepts an optional existing camera MediaStream to avoid re-acquiring the camera.
 * If no stream is provided, acquires camera+mic fresh.
 */
export async function startRecording(existingCameraStream = null) {
    try {
        recordedChunks = [];

        let videoStream = existingCameraStream;

        // If no existing camera stream, acquire one
        if (!videoStream) {
            try {
                videoStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 24 } },
                    audio: false,
                });
            } catch (camErr) {
                console.error('Camera access denied for recording:', camErr.message);
                return false;
            }
        }

        // Capture microphone separately
        const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100,
            },
        });

        // Combine camera video + mic audio into one stream
        recordingStream = new MediaStream([
            ...videoStream.getVideoTracks(),
            ...micStream.getAudioTracks(),
        ]);

        // Determine best codec
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
            ? 'video/webm;codecs=vp9,opus'
            : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
                ? 'video/webm;codecs=vp8,opus'
                : MediaRecorder.isTypeSupported('video/webm')
                    ? 'video/webm'
                    : 'video/mp4';

        mediaRecorder = new MediaRecorder(recordingStream, {
            mimeType,
            videoBitsPerSecond: 500000, // 500kbps for decent quality
        });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onerror = (e) => {
            console.error('MediaRecorder error:', e);
        };

        // Record in 5-second chunks for reliability
        mediaRecorder.start(5000);
        console.log('Recording started (camera + mic)');
        return true;
    } catch (err) {
        console.error('Failed to start recording:', err);
        return false;
    }
}

/**
 * Stop recording and return the blob.
 * Returns a Promise<Blob|null>
 */
export function stopRecording() {
    return new Promise((resolve) => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            cleanup();
            if (recordedChunks.length > 0) {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                console.log(`Recording stopped (was inactive). Blob size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
                resolve(blob);
            } else {
                console.warn('Recording stopped but no chunks recorded.');
                resolve(null);
            }
            return;
        }

        mediaRecorder.onstop = () => {
            const blob = recordedChunks.length > 0
                ? new Blob(recordedChunks, { type: 'video/webm' })
                : null;
            if (blob) {
                console.log(`Recording stopped. Blob size: ${(blob.size / 1024 / 1024).toFixed(2)} MB, chunks: ${recordedChunks.length}`);
            } else {
                console.warn('Recording stopped but blob is empty.');
            }
            cleanup();
            resolve(blob);
        };

        mediaRecorder.stop();
    });
}

/** Check if currently recording */
export function isRecording() {
    return mediaRecorder && mediaRecorder.state === 'recording';
}

function cleanup() {
    // Don't stop the camera tracks — they're shared with the interview video feed
    // Only stop mic audio tracks that we created for recording
    if (recordingStream) {
        recordingStream.getAudioTracks().forEach(t => t.stop());
        recordingStream = null;
    }
    mediaRecorder = null;
}
