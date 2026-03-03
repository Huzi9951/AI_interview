// =============================================
// Recording Service — Screen + Mic capture
// Completely non-blocking, runs in background
// =============================================

let mediaRecorder = null;
let recordedChunks = [];
let screenStream = null;
let combinedStream = null;

/**
 * Check if all required permissions/APIs are available.
 * Returns { camera: bool, microphone: bool, screen: bool, allPassed: bool }
 */
export async function checkPermissions() {
    const result = { camera: false, microphone: false, screen: false, allPassed: false };

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

    // Check screen capture support (don't actually capture, just check API exists)
    try {
        result.screen = typeof navigator.mediaDevices.getDisplayMedia === 'function';
    } catch (e) {
        result.screen = false;
    }

    result.allPassed = result.camera && result.microphone && result.screen;
    return result;
}

/**
 * Start recording screen + microphone audio.
 * The camera stream is NOT included — it remains separate for display.
 * This function is fire-and-forget; it does not block the interview.
 */
export async function startRecording() {
    try {
        recordedChunks = [];
        let videoStream = null;

        // Try screen capture first, fall back to camera if denied
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: { ideal: 854 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 10, max: 15 },
                },
                audio: true,
            });
            videoStream = screenStream;
        } catch (screenErr) {
            console.warn('Screen capture denied, falling back to camera-only recording:', screenErr.message);
            // Fall back to camera recording
            try {
                const camStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 10, max: 15 } },
                });
                videoStream = camStream;
                screenStream = camStream; // store for cleanup
            } catch (camErr) {
                console.error('Camera also denied:', camErr.message);
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

        // Combine video + mic audio into one stream
        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();

        // Add mic audio
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(destination);

        // Add system audio if stream has audio tracks
        if (videoStream.getAudioTracks().length > 0) {
            const sysSource = audioContext.createMediaStreamSource(
                new MediaStream(videoStream.getAudioTracks())
            );
            sysSource.connect(destination);
        }

        // Combine: video + mixed audio
        combinedStream = new MediaStream([
            ...videoStream.getVideoTracks(),
            ...destination.stream.getAudioTracks(),
        ]);

        // Determine best codec
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
            ? 'video/webm;codecs=vp9,opus'
            : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
                ? 'video/webm;codecs=vp8,opus'
                : 'video/webm';

        mediaRecorder = new MediaRecorder(combinedStream, {
            mimeType,
            videoBitsPerSecond: 200000,
        });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onerror = (e) => {
            console.error('MediaRecorder error:', e);
        };

        // Handle user stopping screen share via browser UI
        videoStream.getVideoTracks()[0].onended = () => {
            console.log('Screen/camera sharing stopped by user');
            stopRecording();
        };

        // Record in 5-second chunks for reliability
        mediaRecorder.start(5000);
        console.log('Recording started (video + mic)');
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
    if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
        screenStream = null;
    }
    if (combinedStream) {
        combinedStream.getTracks().forEach(t => t.stop());
        combinedStream = null;
    }
    mediaRecorder = null;
}
