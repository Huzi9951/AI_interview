// Speech service using Deepgram APIs
// STT: WebSocket live transcription (wss://api.deepgram.com/v1/listen)
// TTS: WebSocket streaming (wss://api.deepgram.com/v1/speak) — gapless scheduled playback

const DEEPGRAM_API_KEY = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
const TTS_SAMPLE_RATE = 24000;

import { getSharedMicStream } from './mediaStore';

// =============================================
// Shared AudioContext
// =============================================
let audioContext = null;

function getAudioContext() {
    if (!audioContext || audioContext.state === 'closed') {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: TTS_SAMPLE_RATE });
    }
    return audioContext;
}

// =============================================
// TTS: WebSocket Streaming — gapless playback
// =============================================
let ttsAborted = false;
let ttsWs = null;
let ttsResolve = null;
let ttsScheduledEnd = 0;   // AudioContext time when last scheduled chunk ends
let ttsSources = [];       // all scheduled AudioBufferSourceNodes (for stopSpeaking)
let ttsFlushed = false;    // server sent Flushed event
let ttsPlaybackDone = false;
let ttsLastSourceNode = null;

// =============================================
// Warm-up: pre-initialize AudioContext
// =============================================
export async function warmUp() {
    if (typeof window === 'undefined') return;
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }
        // Play a tiny silent buffer to fully activate the audio pipeline
        const silentBuffer = ctx.createBuffer(1, 1, TTS_SAMPLE_RATE);
        const source = ctx.createBufferSource();
        source.buffer = silentBuffer;
        source.connect(ctx.destination);
        source.start();
        console.log('AudioContext warmed up successfully');
    } catch (e) {
        console.warn('AudioContext warm-up failed:', e);
    }
}

export async function speak(text) {
    if (typeof window === 'undefined') return;

    if (!DEEPGRAM_API_KEY) {
        console.error('NEXT_PUBLIC_DEEPGRAM_API_KEY is not set');
        return fallbackSpeak(text);
    }

    stopSpeaking();
    ttsAborted = false;
    ttsFlushed = false;
    ttsPlaybackDone = false;
    ttsLastSourceNode = null;

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        await ctx.resume();
    }

    ttsScheduledEnd = ctx.currentTime; // start playback immediately
    ttsSources = [];

    return new Promise((resolve) => {
        ttsResolve = resolve;

        const wsUrl = `wss://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=linear16&sample_rate=${TTS_SAMPLE_RATE}`;
        ttsWs = new WebSocket(wsUrl, ['token', DEEPGRAM_API_KEY]);
        ttsWs.binaryType = 'arraybuffer';

        ttsWs.onopen = () => {
            if (ttsAborted) { closeTtsWs(); return; }
            ttsWs.send(JSON.stringify({ type: 'Speak', text }));
            ttsWs.send(JSON.stringify({ type: 'Flush' }));
        };

        ttsWs.onmessage = (event) => {
            if (ttsAborted) return;

            if (event.data instanceof ArrayBuffer && event.data.byteLength > 0) {
                // Convert PCM16 to Float32 and schedule immediately — no debounce
                const pcm = new Int16Array(event.data);
                const floats = new Float32Array(pcm.length);
                for (let i = 0; i < pcm.length; i++) {
                    floats[i] = pcm[i] / 32768;
                }
                scheduleChunk(floats);
            } else if (typeof event.data === 'string') {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'Flushed') {
                        ttsFlushed = true;
                        closeTtsWs();
                        checkPlaybackComplete();
                    }
                } catch (e) { }
            }
        };

        ttsWs.onerror = (err) => {
            console.error('Deepgram TTS WebSocket error:', err);
            closeTtsWs();
            fallbackSpeak(text).then(() => finishTts());
        };

        ttsWs.onclose = () => {
            if (!ttsFlushed && !ttsAborted) {
                ttsFlushed = true;
                checkPlaybackComplete();
            }
        };
    });

    function scheduleChunk(floats) {
        if (ttsAborted) return;

        const ctx = getAudioContext();
        const buffer = ctx.createBuffer(1, floats.length, TTS_SAMPLE_RATE);
        buffer.getChannelData(0).set(floats);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        const startTime = Math.max(ctx.currentTime, ttsScheduledEnd);
        source.start(startTime);
        ttsScheduledEnd = startTime + buffer.duration;
        ttsSources.push(source);
        ttsLastSourceNode = source;

        source.onended = () => {
            if (source === ttsLastSourceNode) {
                ttsPlaybackDone = true;
                checkPlaybackComplete();
            }
        };
    }

    function checkPlaybackComplete() {
        if (ttsFlushed && ttsPlaybackDone) {
            finishTts();
        }
        if (ttsFlushed && ttsSources.length === 0) {
            finishTts();
        }
    }
}

function closeTtsWs() {
    if (ttsWs) {
        try {
            if (ttsWs.readyState === WebSocket.OPEN) {
                ttsWs.send(JSON.stringify({ type: 'Close' }));
            }
            ttsWs.close();
        } catch (e) { }
        ttsWs = null;
    }
}

function finishTts() {
    closeTtsWs();
    if (ttsResolve) {
        const r = ttsResolve;
        ttsResolve = null;
        r();
    }
}

function fallbackSpeak(text) {
    return new Promise((resolve) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) { resolve(); return; }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
    });
}

export function stopSpeaking() {
    ttsAborted = true;

    for (const source of ttsSources) {
        try { source.stop(); } catch (e) { }
    }
    ttsSources = [];

    closeTtsWs();

    if (ttsResolve) {
        const r = ttsResolve;
        ttsResolve = null;
        r();
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
}

// =============================================
// STT: Deepgram WebSocket (real-time transcription)
// =============================================
let ws = null;
let mediaRecorder = null;
let mediaStream = null;
let currentCallback = null;
let finalTranscript = '';
let lastTranscriptLength = 0; // track actual content changes for silence detection

export function startListening(onUpdate) {
    if (typeof window === 'undefined') return;

    if (!DEEPGRAM_API_KEY) {
        console.error('NEXT_PUBLIC_DEEPGRAM_API_KEY is not set. Falling back to Web Speech API.');
        return fallbackStartListening(onUpdate);
    }

    stopListening();
    currentCallback = onUpdate;
    finalTranscript = '';
    lastTranscriptLength = 0;

    let fallbackActive = false;

    getSharedMicStream()
        .then((stream) => {
            mediaStream = stream;

            const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-3&punctuate=true&interim_results=true&endpointing=10000&smart_format=true&language=en-US`;
            ws = new WebSocket(wsUrl, ['token', DEEPGRAM_API_KEY]);

            ws.onopen = () => {
                console.log('Deepgram STT WebSocket connected');

                mediaRecorder = new MediaRecorder(stream, {
                    mimeType: getSupportedMimeType(),
                });

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0 && ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(event.data);
                    }
                };

                mediaRecorder.start(250);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'Results') {
                        const transcript = data.channel?.alternatives?.[0]?.transcript || '';
                        const isFinal = data.is_final;

                        if (isFinal && transcript) {
                            finalTranscript += transcript + ' ';
                        }

                        const interim = isFinal ? '' : transcript;
                        const combined = (finalTranscript + interim).trim();

                        // Only flag hasNewContent when actual text changes
                        const hasNewContent = combined.length > lastTranscriptLength;
                        if (hasNewContent) {
                            lastTranscriptLength = combined.length;
                        }

                        if (currentCallback) {
                            currentCallback({
                                final: finalTranscript.trim(),
                                interim: interim,
                                combined: combined,
                                hasContent: combined.length > 0,
                                hasNewContent: hasNewContent, // true only when new words appear
                            });
                        }
                    }
                } catch (e) {
                    console.warn('Error parsing Deepgram message:', e);
                }
            };

            ws.onerror = (err) => {
                console.error('Deepgram WebSocket error:', err);
                if (!fallbackActive) {
                    fallbackActive = true;
                    console.log('Falling back to Web Speech API due to Deepgram error');
                    fallbackStartListening(onUpdate);
                }
            };

            ws.onclose = (event) => {
                console.log('Deepgram WebSocket closed:', event.code, event.reason);
                // Codes other than 1000 (Normal) and 1005 (No Status) suggest a failure
                if (event.code !== 1000 && event.code !== 1005 && !fallbackActive) {
                    fallbackActive = true;
                    console.log('Falling back to Web Speech API due to abnormal Deepgram closure');
                    fallbackStartListening(onUpdate);
                }
            };
        })
        .catch((err) => {
            console.error('Microphone access denied:', err);
        });
}

function getSupportedMimeType() {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'audio/webm';
}

export function stopListening() {
    currentCallback = null;
    finalTranscript = '';
    lastTranscriptLength = 0;

    if (mediaRecorder) {
        try { mediaRecorder.stop(); } catch (e) { }
        mediaRecorder = null;
    }

    if (ws) {
        try {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'CloseStream' }));
            }
            ws.close();
        } catch (e) { }
        ws = null;
    }

    if (mediaStream) {
        // We no longer stop the tracks here because it's a shared stream!
        // mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
    }
}

export function resetTranscript() {
    const cb = currentCallback;
    stopListening();
    if (cb) {
        startListening(cb);
    }
}

export function isListening() {
    return ws !== null && currentCallback !== null;
}

// =============================================
// Fallback: Web Speech API
// =============================================
let fallbackRecognition = null;
let fallbackCallback = null;

function fallbackStartListening(onUpdate) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.error('Neither Deepgram nor Web Speech API available.');
        return;
    }

    fallbackCallback = onUpdate;
    fallbackRecognition = new SpeechRecognition();
    fallbackRecognition.continuous = true;
    fallbackRecognition.interimResults = true;
    fallbackRecognition.lang = 'en-US';

    // Note: Web Speech API handles mic internally.
    // We just start it.

    let fallbackFinalTranscript = '';

    fallbackRecognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                fallbackFinalTranscript += event.results[i][0].transcript + ' ';
            } else {
                interim += event.results[i][0].transcript;
            }
        }
        if (fallbackCallback) {
            fallbackCallback({
                final: fallbackFinalTranscript.trim(),
                interim,
                combined: (fallbackFinalTranscript + interim).trim(),
                hasContent: (fallbackFinalTranscript + interim).trim().length > 0,
                hasNewContent: true,
            });
        }
    };

    fallbackRecognition.onend = () => {
        if (fallbackRecognition && fallbackCallback) {
            try { fallbackRecognition.start(); } catch (e) { }
        }
    };

    fallbackRecognition.onerror = (event) => {
        if (event.error !== 'not-allowed' && fallbackRecognition && fallbackCallback) {
            setTimeout(() => {
                try { if (fallbackRecognition) fallbackRecognition.start(); } catch (e) { }
            }, 500);
        }
    };

    try { fallbackRecognition.start(); } catch (e) { }
}
