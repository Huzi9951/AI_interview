'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

const SILENCE_NO_SPEECH = 13000;   // 13s no speech at all → ask to repeat
const SILENCE_AFTER_SPEECH = 7000; // 7s after person stops speaking → move on
const FACE_CHECK_INTERVAL = 1000;  // Check face every 1 second

export default function InterviewPage() {
    const router = useRouter();

    const [interviewData, setInterviewData] = useState(null);
    const [phase, setPhase] = useState('loading');
    const [maxQuestions, setMaxQuestions] = useState(6);
    const maxQuestionsRef = useRef(6);
    const [consentGiven, setConsentGiven] = useState(false);

    // Questions & answers
    const questionsRef = useRef([]);
    const answersRef = useRef([]);
    const customQuestionsRef = useRef([]);
    const evaluationsRef = useRef([]);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [questionIndex, setQuestionIndex] = useState(0);
    const questionIndexRef = useRef(0);
    const [displayHistory, setDisplayHistory] = useState([]);

    // Avatar
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Camera & face detection
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [faceStatus, setFaceStatus] = useState('detecting');
    const [faceCount, setFaceCount] = useState(0);
    const faceDetectorRef = useRef(null);
    const lastFaceSeenRef = useRef(Date.now());

    // Violations
    const violationsRef = useRef([]);
    const [violationCount, setViolationCount] = useState(0);

    // Evaluation toast
    const [showEval, setShowEval] = useState(null);

    // Processing
    const [processingMsg, setProcessingMsg] = useState('');

    // Silence detection
    const silenceTimerRef = useRef(null);
    const speechStoppedTimerRef = useRef(null);
    const hasSpokenRef = useRef(false);
    const currentAnswerRef = useRef('');
    const phaseRef = useRef('loading');
    const interviewDataRef = useRef(null);
    const lastSpeechTimeRef = useRef(0);



    useEffect(() => { phaseRef.current = phase; }, [phase]);
    useEffect(() => { interviewDataRef.current = interviewData; }, [interviewData]);

    // =============================================
    // Load interview data
    // =============================================
    useEffect(() => {
        const data = sessionStorage.getItem('visionhire_setup');
        if (!data) { router.push('/setup'); return; }
        const parsed = JSON.parse(data);
        setInterviewData(parsed);
        interviewDataRef.current = parsed;
        const customQs = parsed.customQuestions || [];
        customQuestionsRef.current = customQs;
        const qCount = (parsed.questionCount || 6) + customQs.length;
        setMaxQuestions(qCount);
        maxQuestionsRef.current = qCount;
        setPhase('consent');
    }, [router]);

    // =============================================
    // Request mic permission after consent
    // =============================================
    useEffect(() => {
        if (interviewData && consentGiven) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => { stream.getTracks().forEach(t => t.stop()); })
                .catch(err => console.error('Mic permission denied:', err));
        }
    }, [interviewData, consentGiven]);

    // =============================================
    // Start camera after consent
    // =============================================
    useEffect(() => {
        async function startCamera() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, facingMode: 'user' },
                    audio: false,
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    setCameraActive(true);
                }
            } catch (err) {
                console.error('Camera error:', err);
            }
        }
        if (interviewData && consentGiven) startCamera();
        return () => {
            if (videoRef.current?.srcObject) {
                videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
            }
        };
    }, [interviewData, consentGiven]);

    // =============================================
    // Real-time face detection every 1 second
    // =============================================
    useEffect(() => {
        if (!cameraActive) return;

        // Try to use browser's FaceDetector API (Chrome)
        let detector = null;
        let useNativeDetector = false;

        async function initFaceDetector() {
            try {
                if ('FaceDetector' in window) {
                    detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
                    faceDetectorRef.current = detector;
                    useNativeDetector = true;
                    console.log('Using native FaceDetector API');
                }
            } catch (e) {
                console.log('Native FaceDetector not available, using canvas fallback');
            }
        }

        initFaceDetector();

        const interval = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;

            if (useNativeDetector && detector) {
                // Native Chrome FaceDetector
                try {
                    const faces = await detector.detect(videoRef.current);
                    const count = faces.length;
                    setFaceCount(count);

                    if (count === 1) {
                        setFaceStatus('ok');
                        lastFaceSeenRef.current = Date.now();
                    } else if (count === 0) {
                        setFaceStatus('noface');
                        // If face gone for >5 seconds → violation
                        if (Date.now() - lastFaceSeenRef.current > 5000) {
                            addViolation('face_missing', 'No face detected for more than 5 seconds');
                            lastFaceSeenRef.current = Date.now(); // reset to avoid spam
                        }
                    } else {
                        setFaceStatus('multiface');
                        addViolation('multiple_faces', `${count} faces detected — only 1 allowed`);
                    }
                } catch (e) {
                    // Fallback to canvas
                    canvasFallbackCheck();
                }
            } else {
                // Canvas-based fallback: check if video feed has content
                canvasFallbackCheck();
            }
        }, FACE_CHECK_INTERVAL);

        return () => clearInterval(interval);
    }, [cameraActive]);

    function canvasFallbackCheck() {
        if (!videoRef.current || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = 160;
        canvas.height = 120;
        ctx.drawImage(videoRef.current, 0, 0, 160, 120);
        const imageData = ctx.getImageData(0, 0, 160, 120);
        const data = imageData.data;

        // Check pixel variance to determine if someone is in front of camera
        let totalBrightness = 0;
        let pixelCount = data.length / 4;
        for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel
            totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
        }
        const avgBrightness = totalBrightness / (pixelCount / 4);

        // If brightness is extremely low (covered/off) or normal
        if (avgBrightness < 10) {
            setFaceStatus('noface');
            setFaceCount(0);
        } else {
            setFaceStatus('ok');
            setFaceCount(1);
            lastFaceSeenRef.current = Date.now();
        }
    }

    function addViolation(type, message) {
        if (phaseRef.current === 'loading' || phaseRef.current === 'done') return;
        const v = { type, message, timestamp: new Date().toISOString() };
        violationsRef.current = [...violationsRef.current, v];
        setViolationCount(violationsRef.current.length);
    }

    // =============================================
    // Tab switch detection
    // =============================================
    useEffect(() => {
        const handleVisibility = () => {
            if (document.hidden) addViolation('tab_switch', 'Tab switch detected');
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []);

    // =============================================
    // Start interview automatically
    // =============================================
    // Handle consent acceptance
    const acceptConsent = () => {
        setConsentGiven(true);
        setPhase('ready');
    };

    useEffect(() => {
        if (phase === 'ready' && interviewData && consentGiven) {
            const t = setTimeout(() => askNextQuestion(0), 1500);
            return () => clearTimeout(t);
        }
    }, [phase, interviewData, consentGiven]);

    // =============================================
    // Ask next question
    // =============================================
    const askNextQuestion = async (qIdx) => {
        if (qIdx >= maxQuestionsRef.current) { endInterview(); return; }

        setPhase('asking');
        setCurrentAnswer('');
        hasSpokenRef.current = false;
        currentAnswerRef.current = '';
        lastSpeechTimeRef.current = 0;

        const customQs = customQuestionsRef.current;
        let questionText;

        if (qIdx < customQs.length) {
            // Use custom question directly (no AI generation needed)
            setProcessingMsg('Preparing question...');
            questionText = customQs[qIdx];
        } else {
            // AI-generated question
            setProcessingMsg('Generating next question...');
            try {
                const { generateQuestion } = await import('@/lib/groqService');
                const context = {
                    skillAnalysis: interviewDataRef.current.skillAnalysis,
                    questions: questionsRef.current,
                    answers: answersRef.current,
                    evaluations: evaluationsRef.current,
                    maxQuestions: maxQuestionsRef.current,
                    customQuestions: customQs,
                };
                const result = await generateQuestion(context);
                questionText = result.question;
            } catch (err) {
                console.error('Question generation error:', err);
                questionText = 'Could you tell me more about your experience relevant to this role?';
            }
        }

        setCurrentQuestion(questionText);
        questionsRef.current = [...questionsRef.current, questionText];
        setQuestionIndex(qIdx);
        questionIndexRef.current = qIdx;
        setProcessingMsg('');

        try {
            // Stop any active listening before TTS speaks to prevent voice leaking into transcript
            const { stopListening, speak } = await import('@/lib/speechService');
            stopListening();

            setIsSpeaking(true);
            await speak(questionText);
            setIsSpeaking(false);

            startListeningPhase();
        } catch (err) {
            console.error('Speech error:', err);
            setIsSpeaking(false);
            startListeningPhase();
        }
    };

    // =============================================
    // Start listening — always on
    // =============================================
    const startListeningPhase = async () => {
        setPhase('listening');
        hasSpokenRef.current = false;
        currentAnswerRef.current = '';
        lastSpeechTimeRef.current = 0;
        setCurrentAnswer('');

        const { startListening } = await import('@/lib/speechService');

        startListening((data) => {
            currentAnswerRef.current = data.combined;
            setCurrentAnswer(data.combined);

            if (data.hasContent && !hasSpokenRef.current) {
                // First speech detected — clear the "no speech" timer
                hasSpokenRef.current = true;
                clearAllTimers();
            }

            if (data.hasNewContent) {
                lastSpeechTimeRef.current = Date.now();

                // Reset the "done speaking" timer — 7s of no new words → auto-submit
                if (speechStoppedTimerRef.current) clearTimeout(speechStoppedTimerRef.current);
                speechStoppedTimerRef.current = setTimeout(() => {
                    if (hasSpokenRef.current && currentAnswerRef.current.trim().length > 0) {
                        submitAnswer();
                    }
                }, SILENCE_AFTER_SPEECH);
            }
        });

        // Start 13-second "no speech at all" timer
        silenceTimerRef.current = setTimeout(() => {
            if (!hasSpokenRef.current || currentAnswerRef.current.trim().length === 0) {
                setPhase('silencePrompt');
                offerRepeat();
            }
        }, SILENCE_NO_SPEECH);
    };

    // =============================================
    // Clear all timers
    // =============================================
    const clearAllTimers = () => {
        if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
        if (speechStoppedTimerRef.current) { clearTimeout(speechStoppedTimerRef.current); speechStoppedTimerRef.current = null; }
    };

    // =============================================
    // Offer to repeat question
    // =============================================
    const offerRepeat = async () => {
        clearAllTimers();
        const { speak, stopListening } = await import('@/lib/speechService');
        stopListening();

        setIsSpeaking(true);
        await speak("I didn't catch a response. Would you like me to repeat the question? You can start speaking whenever you're ready.");
        setIsSpeaking(false);

        // Restart listening for second chance
        hasSpokenRef.current = false;
        currentAnswerRef.current = '';
        setCurrentAnswer('');
        setPhase('listening');

        const { startListening } = await import('@/lib/speechService');
        startListening((data) => {
            currentAnswerRef.current = data.combined;
            setCurrentAnswer(data.combined);
            if (data.hasContent && !hasSpokenRef.current) {
                hasSpokenRef.current = true;
                clearAllTimers();
            }
            if (data.hasNewContent) {
                lastSpeechTimeRef.current = Date.now();
                if (speechStoppedTimerRef.current) clearTimeout(speechStoppedTimerRef.current);
                speechStoppedTimerRef.current = setTimeout(() => {
                    if (hasSpokenRef.current && currentAnswerRef.current.trim().length > 0) {
                        submitAnswer();
                    }
                }, SILENCE_AFTER_SPEECH);
            }
        });

        // Second chance: 13s no speech → skip
        silenceTimerRef.current = setTimeout(() => {
            if (!hasSpokenRef.current || currentAnswerRef.current.trim().length === 0) {
                moveToNextQuestion('[No response provided]');
            }
        }, SILENCE_NO_SPEECH);
    };

    const repeatQuestion = async () => {
        clearAllTimers();
        const { stopListening, speak } = await import('@/lib/speechService');
        stopListening();

        setPhase('asking');
        hasSpokenRef.current = false;
        currentAnswerRef.current = '';
        setCurrentAnswer('');

        setIsSpeaking(true);
        await speak(currentQuestion);
        setIsSpeaking(false);

        startListeningPhase();
    };

    // =============================================
    // Submit / skip
    // =============================================
    const submitAnswer = async () => {
        clearAllTimers();
        const { stopListening } = await import('@/lib/speechService');
        stopListening();
        const answer = currentAnswerRef.current.trim() || '[No response]';
        await processAnswer(answer);
    };

    const moveToNextQuestion = async (answer) => {
        clearAllTimers();
        const { stopListening } = await import('@/lib/speechService');
        stopListening();
        await processAnswer(answer || '[No response provided]');
    };

    // =============================================
    // Process answer
    // =============================================
    const processAnswer = async (answer) => {
        setPhase('evaluating');
        setProcessingMsg('Evaluating your answer...');
        answersRef.current = [...answersRef.current, answer];

        setDisplayHistory(prev => [...prev, { question: currentQuestion, answer, score: null }]);

        try {
            const { evaluateAnswer } = await import('@/lib/groqService');
            const evaluation = await evaluateAnswer(currentQuestion, answer, {
                targetSkill: interviewDataRef.current.skillAnalysis?.interview_focus_areas?.[questionIndexRef.current] || '',
                jobTitle: interviewDataRef.current.skillAnalysis?.job_title || '',
            });
            evaluationsRef.current = [...evaluationsRef.current, evaluation];
            setDisplayHistory(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], score: evaluation.score };
                return updated;
            });
            setShowEval(evaluation);
            setTimeout(() => setShowEval(null), 3000);
            setProcessingMsg('');

            const nextIdx = questionIndexRef.current + 1;
            if (nextIdx >= maxQuestionsRef.current) { endInterview(); }
            else { await new Promise(r => setTimeout(r, 1500)); askNextQuestion(nextIdx); }
        } catch (err) {
            console.error('Evaluation error:', err);
            evaluationsRef.current = [...evaluationsRef.current, { score: 0 }];
            setProcessingMsg('');
            const nextIdx = questionIndexRef.current + 1;
            if (nextIdx >= maxQuestionsRef.current) { endInterview(); }
            else { askNextQuestion(nextIdx); }
        }
    };

    // =============================================
    // End interview
    // =============================================
    const endInterview = async () => {
        clearAllTimers();
        try {
            const { stopListening, stopSpeaking } = await import('@/lib/speechService');
            stopListening(); stopSpeaking();
        } catch (e) { }

        // Turn off camera
        if (videoRef.current?.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);

        setPhase('done');
        setProcessingMsg('Generating your comprehensive report...');



        try {
            const { generateFinalReport, generateCodingProblem } = await import('@/lib/groqService');
            const reportData = {
                skillAnalysis: interviewDataRef.current.skillAnalysis,
                questions: questionsRef.current,
                answers: answersRef.current,
                evaluations: evaluationsRef.current,
                violations: violationsRef.current,
                codingEvaluation: null,
                includeCodingRound: interviewDataRef.current.includeCodingRound,
            };
            const finalReport = await generateFinalReport(reportData);
            const reportPayload = {
                ...reportData, finalReport,
                jobDescription: interviewDataRef.current.jobDescription,
                resumeFileName: interviewDataRef.current.resumeFileName,
            };
            sessionStorage.setItem('visionhire_report', JSON.stringify(reportPayload));
            setProcessingMsg('');

            if (interviewDataRef.current.includeCodingRound) {
                const codingProblem = await generateCodingProblem(interviewDataRef.current.skillAnalysis);
                sessionStorage.setItem('visionhire_coding', JSON.stringify(codingProblem));
                router.push('/coding');
            } else {
                router.push('/report');
            }
        } catch (err) {
            console.error('Report error:', err);
            setProcessingMsg('');
            router.push('/report');
        }
    };

    // =============================================
    // Render
    // =============================================
    if (phase === 'loading' || !interviewData) {
        return (
            <div className={styles.processingOverlay}>
                <div className={styles.spinner} />
                <div className={styles.processingText}>Loading interview...</div>
            </div>
        );
    }

    if (phase === 'consent') {
        return (
            <div className={styles.consentPage}>
                <div className={styles.consentCard}>
                    <div className={styles.consentIcon}>🎯</div>
                    <h1 className={styles.consentTitle}>Before We Begin</h1>
                    <p className={styles.consentSubtitle}>Please review the following terms before starting your interview.</p>
                    <div className={styles.consentTerms}>
                        <div className={styles.consentItem}>
                            <span className={styles.consentBullet}>📷</span>
                            <div>
                                <strong>Camera Monitoring</strong>
                                <p>Your camera feed will be actively monitored for face detection and identity verification.</p>
                            </div>
                        </div>
                        <div className={styles.consentItem}>
                            <span className={styles.consentBullet}>🎙️</span>
                            <div>
                                <strong>Audio Capture</strong>
                                <p>Your microphone will be used throughout the interview for voice-based responses.</p>
                            </div>
                        </div>
                        <div className={styles.consentItem}>
                            <span className={styles.consentBullet}>🛡️</span>
                            <div>
                                <strong>Proctoring</strong>
                                <p>Tab switches, focus loss, and other activities will be monitored and logged as potential violations.</p>
                            </div>
                        </div>
                    </div>
                    <div className={styles.consentWarning}>
                        ⚠️ By clicking &ldquo;I Accept &amp; Begin Interview&rdquo; below, you consent to camera monitoring and proctoring throughout this session.
                    </div>
                    <div className={styles.consentActions}>
                        <button className={styles.consentDecline} onClick={() => router.push('/setup')}>Decline</button>
                        <button className={styles.consentAccept} onClick={acceptConsent}>I Accept &amp; Begin Interview</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.interviewPage}>
            {/* Hidden canvas for face detection */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Top Bar */}
            <div className={styles.topBar}>
                <div className={styles.topBarLeft}>
                    <div className={styles.logo}>
                        <div className={styles.logoIcon}>⚡</div>
                        Vision<span style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Hire</span>
                    </div>
                    <div className={`${styles.statusBadge} ${styles.statusLive}`}>
                        <div className={styles.statusDot} />
                        Interview Live
                    </div>
                </div>
                <div className={styles.topBarRight}>
                    <span className={styles.questionCount}>
                        Q {Math.min(questionIndex + 1, maxQuestions)} / {maxQuestions}
                    </span>
                    {violationCount > 0 && (
                        <span className={styles.violationBadge}>
                            ⚠ {violationCount} violation{violationCount > 1 ? 's' : ''}
                        </span>
                    )}
                    <button className={styles.endBtn} onClick={endInterview}>End Interview</button>
                </div>
            </div>

            {/* Main Content */}
            <div className={styles.mainContent}>
                {/* Left: Avatar + Q&A */}
                <div className={styles.leftPanel}>
                    <div className={styles.avatarSection}>
                        <div className={`${styles.avatar} ${isSpeaking ? styles.avatarSpeaking : ''}`}>
                            🤖
                            {isSpeaking && (
                                <div className={styles.avatarWaveform}>
                                    <div className={styles.waveBar} />
                                    <div className={styles.waveBar} />
                                    <div className={styles.waveBar} />
                                    <div className={styles.waveBar} />
                                    <div className={styles.waveBar} />
                                </div>
                            )}
                        </div>
                        <div className={styles.avatarInfo}>
                            <div className={styles.avatarName}>VisionHire Interviewer</div>
                            <div className={styles.avatarStatus}>
                                {isSpeaking
                                    ? '🔊 Speaking...'
                                    : phase === 'listening'
                                        ? '🎙️ Listening to your answer...'
                                        : phase === 'evaluating'
                                            ? '🧠 Evaluating...'
                                            : phase === 'silencePrompt'
                                                ? '🔇 Waiting for response...'
                                                : phase === 'ready'
                                                    ? '⏳ Preparing...'
                                                    : '💭 Thinking...'}
                            </div>
                        </div>
                    </div>

                    <div className={styles.questionArea}>
                        {currentQuestion && (
                            <div className={styles.questionBubble}>
                                <div className={styles.questionLabel}>Question {questionIndex + 1}</div>
                                <div className={styles.questionText}>{currentQuestion}</div>
                            </div>
                        )}

                        {(phase === 'listening' || phase === 'silencePrompt') && (
                            <div className={styles.answerArea}>
                                <div className={styles.answerLabel}>
                                    <div className={styles.listeningDot} />
                                    Your Response {phase === 'listening' && '(Listening...)'}
                                </div>
                                <div className={`${styles.answerText} ${!currentAnswer ? styles.answerTextEmpty : ''}`}>
                                    {currentAnswer || 'Speak your answer — the microphone is always on...'}
                                </div>
                            </div>
                        )}

                        {phase === 'silencePrompt' && (
                            <div className={styles.silencePrompt}>
                                🔇 No response detected. Would you like me to repeat the question?
                                <div style={{ marginTop: '12px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                    <button className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.85rem' }} onClick={repeatQuestion}>
                                        🔁 Repeat
                                    </button>
                                    <button className="btn-secondary" style={{ padding: '8px 20px', fontSize: '0.85rem' }} onClick={() => moveToNextQuestion()}>
                                        ⏭ Skip
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {phase === 'listening' && (
                        <div className={styles.controls}>
                            <button className={`${styles.controlBtn} ${styles.skipBtn}`} onClick={() => moveToNextQuestion()}>⏭ Skip</button>
                            <button className={`${styles.controlBtn} ${styles.submitAnswerBtn}`} onClick={submitAnswer} disabled={!currentAnswer.trim()}>✓ Submit Answer</button>
                        </div>
                    )}
                </div>

                {/* Right: Camera + Transcript */}
                <div className={styles.rightPanel}>
                    <div className={styles.cameraSection}>
                        <div className={styles.cameraLabel}>
                            📷 Camera Feed
                            {cameraActive && (
                                <span style={{
                                    color: faceStatus === 'ok' ? 'var(--accent-success)' : faceStatus === 'noface' ? 'var(--accent-danger)' : 'var(--accent-warning)',
                                    fontWeight: 600,
                                }}>
                                    ● {faceStatus === 'ok' ? 'Face OK' : faceStatus === 'noface' ? 'No Face!' : faceStatus === 'multiface' ? `${faceCount} Faces!` : 'Detecting...'}
                                </span>
                            )}
                        </div>
                        <div className={`${styles.cameraFeed} ${faceStatus === 'noface' || faceStatus === 'multiface' ? styles.cameraFeedWarning : ''}`}>
                            <video ref={videoRef} autoPlay playsInline muted className={styles.cameraVideo} />
                            <div className={`${styles.cameraOverlay} ${faceStatus === 'ok' ? styles.cameraFaceOk : styles.cameraFaceWarn}`}>
                                {faceStatus === 'ok' ? '✓ 1 face detected' : faceStatus === 'noface' ? '⚠ No face detected' : faceStatus === 'multiface' ? `⚠ ${faceCount} faces detected` : '🔍 Detecting...'}
                            </div>
                        </div>
                    </div>

                    <div className={styles.transcriptSection}>
                        <div className={styles.transcriptTitle}>📝 Transcript</div>
                        {displayHistory.map((item, i) => (
                            <div key={i} className={styles.transcriptItem}>
                                <div className={styles.transcriptQ}>Q{i + 1}: {item.question.substring(0, 60)}...</div>
                                <div className={styles.transcriptA}>{item.answer.substring(0, 80)}{item.answer.length > 80 ? '...' : ''}</div>
                                {item.score !== null && <div className={styles.transcriptScore}>Score: {item.score}/10</div>}
                            </div>
                        ))}
                        {displayHistory.length === 0 && (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                Transcript will appear here...
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showEval && (
                <div className={styles.evalToast}>
                    <div className={styles.evalScore}>Score: {showEval.score}/10</div>
                    <div className={styles.evalDetails}>
                        <span>Depth: {showEval.technical_depth}/10</span>
                        <span>Clarity: {showEval.clarity}/10</span>
                        <span>Relevance: {showEval.relevance}/10</span>
                    </div>
                </div>
            )}

            {processingMsg && (
                <div className={styles.processingOverlay}>
                    <div className={styles.spinner} />
                    <div className={styles.processingText}>{processingMsg}</div>
                </div>
            )}
        </div>
    );
}
