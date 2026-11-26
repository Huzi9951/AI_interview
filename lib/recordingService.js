// =============================================
// Recording Service — Camera + Mic capture
// No screen sharing required. Works on all browsers.
// =============================================

import { getSharedMicStream, getSharedCameraStream } from './mediaStore';

let mediaRecorder = null;
let recordedChunks = [];
let recordingStream = null;

/**
 * Check if all required permissions/APIs are available.
 * Returns { camera: bool, microphone: bool, screen: true, allPassed: bool }
 * No screen permission needed — we record camera+mic directly.
 */
export async function checkPermissions() {
    const result = { camera: false, microphone: false, screen: true, allPassed: false };

    // Check camera using shared store (keeps it alive to prevent lockouts)
    try {
        await getSharedCameraStream();
        result.camera = true;
    } catch (e) {
        console.warn('Camera permission denied:', e.message);
    }

    // Check microphone using shared store
    try {
        await getSharedMicStream();
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
        let videoTracks = [];

        if (existingCameraStream) {
            videoTracks = existingCameraStream.getVideoTracks();
        } else {
            const camStream = await getSharedCameraStream();
            videoTracks = camStream.getVideoTracks();
        }

        // Capture microphone separately to ensure audio is present
        const micStream = await getSharedMicStream();

        // Combine camera video + mic audio into one stream
        recordingStream = new MediaStream([
            ...videoTracks,
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
        const startTime = Date.now();
        console.log('Recording started (camera + mic) at', startTime);
        return { success: true, startTime };
    } catch (err) {
        console.error('Failed to start recording:', err);
        return { success: false, error: err };
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
        // We do NOT stop the tracks here anymore because they are shared system-wide
        // recordingStream.getAudioTracks().forEach(t => t.stop());
        recordingStream = null;
    }
    mediaRecorder = null;
}
