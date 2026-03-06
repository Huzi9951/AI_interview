// Centralized storage for media streams
// This prevents multiple components from requesting getUserMedia concurrently,
// which can cause "exclusive mode" hardware lockouts or silent recordings on Windows/Edge.

let sharedMicStream = null;
let sharedCameraStream = null;

export async function getSharedMicStream() {
    if (!sharedMicStream || !sharedMicStream.active) {
        try {
            sharedMicStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true
                },
            });
        } catch (err) {
            console.error('Failed to get shared mic:', err);
            throw err;
        }
    }
    return sharedMicStream;
}

export async function getSharedCameraStream() {
    if (!sharedCameraStream || !sharedCameraStream.active) {
        try {
            sharedCameraStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 24 } },
                audio: false,
            });
        } catch (err) {
            console.error('Failed to get shared camera:', err);
            throw err;
        }
    }
    return sharedCameraStream;
}

export function stopAllSharedStreams() {
    if (sharedMicStream) {
        sharedMicStream.getTracks().forEach(t => t.stop());
        sharedMicStream = null;
    }
    if (sharedCameraStream) {
        sharedCameraStream.getTracks().forEach(t => t.stop());
        sharedCameraStream = null;
    }
}
