'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './page.module.css';
import { getSharedCameraStream, getSharedMicStream, stopAllSharedStreams } from '@/lib/mediaStore';

const SILENCE_NO_SPEECH = 20000;
const SILENCE_AFTER_SPEECH = 7000;
const FACE_CHECK_INTERVAL = 1000;

function InterviewContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [interviewData, setInterviewData] = useState(null);
    const [phase, setPhase] = useState('loading');
    const [maxQuestions, setMaxQuestions] = useState(6);
    const maxQuestionsRef = useRef(6);
    const [consentGiven, setConsentGiven] = useState(false);

    // Permission check state
    const [permissions, setPermissions] = useState({ camera: null, microphone: null, screen: null });
    const [permissionsChecked, setPermissionsChecked] = useState(false);
    const [permissionsError, setPermissionsError] = useState('');

    // DB / token state
    const [interviewId, setInterviewId] = useState(null);
    const interviewIdRef = useRef(null);
    const [tokenData, setTokenData] = useState(null);
    const [alreadyCompleted, setAlreadyCompleted] = useState(false);
    const [noAccess, setNoAccess] = useState(false);

    // Questions & answers
    const questionsRef = useRef([]);
    const answersRef = useRef([]);
    const customQuestionsRef = useRef([]); // [{question, expectedAnswer?}]
    const evaluationsRef = useRef([]);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [prevQuestion, setPrevQuestion] = useState(''); // for smooth transition
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [questionIndex, setQuestionIndex] = useState(0);
    const questionIndexRef = useRef(0);
    const mainQuestionIndexRef = useRef(0); // tracks only main questions (not follow-ups)
    const followUpCountRef = useRef(0);
    const recordingStartTimeRef = useRef(null); // total follow-ups asked
    const isFollowUpRef = useRef(false); // whether current question is a follow-up
    const [displayHistory, setDisplayHistory] = useState([]);

    // Question timestamps
    const questionTimestampsRef = useRef([]);

    // Avatar
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Camera & face detection
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const canvasRef = useRef(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [faceStatus, setFaceStatus] = useState('detecting');
    const [faceCount, setFaceCount] = useState(0);
    const faceDetectorRef = useRef(null);
    const lastFaceSeenRef = useRef(Date.now());

    // Violations (with timestamps)
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

    // Recording
    const recordingStartedRef = useRef(false);

    useEffect(() => { phaseRef.current = phase; }, [phase]);
    useEffect(() => { interviewDataRef.current = interviewData; }, [interviewData]);

    // =============================================
    // Load interview data (from token or sessionStorage)
    // =============================================
    useEffect(() => {
        async function init() {
            const token = searchParams.get('token');

            if (token) {
                // Candidate coming from invite link
                try {
                    const decoded = JSON.parse(atob(token.replace(/-/g, '+').replace(/_/g, '/')));
                    setTokenData(decoded);

                    // Check expiry
                    if (decoded.expiresAt && Date.now() > decoded.expiresAt) {
                        setNoAccess(true);
                        return;
                    }

                    // Check if already completed
                    const tokenHash = btoa(decoded.email + ':' + decoded.jobTitle + ':' + decoded.createdAt).replace(/[^a-zA-Z0-9]/g, '');
                    try {
                        const { hasCompletedInterview } = await import('@/lib/db');
                        const completed = await hasCompletedInterview(tokenHash);
                        if (completed) {
                            setAlreadyCompleted(true);
                            return;
                        }
                    } catch (e) {
                        console.warn('DB check skipped:', e);
                    }

                    // Set interview data from token
                    // customQuestions can be [{question, expectedAnswer}, ...] or ["string", ...]
                    const rawCustomQs = decoded.customQuestions || [];
                    const normalizedQs = rawCustomQs.map(q => typeof q === 'string' ? { question: q, expectedAnswer: '' } : q);
                    const data = {
                        jobDescription: decoded.jobDescription || decoded.jobTitle || '',
                        resumeText: `Candidate: ${decoded.name || 'N/A'}\nEmail: ${decoded.email || 'N/A'}`,
                        resumeFileName: 'invite-candidate.pdf',
                        skillAnalysis: null,
                        includeCodingRound: false,
                        questionCount: decoded.questionCount || 6,
                        customQuestions: normalizedQs,
                        candidateEmail: decoded.email,
                        candidateName: decoded.name || '',
                        jobTitle: decoded.jobTitle || '',
                        jobId: decoded.jobId || '',
                        tokenHash,
                        isCandidate: true,
                    };
                    setInterviewData(data);
                    interviewDataRef.current = data;
                    customQuestionsRef.current = normalizedQs;
                    const qCount = (data.questionCount || 6);
                    setMaxQuestions(qCount);
                    maxQuestionsRef.current = qCount;
                    setPhase('permissions');
                } catch (e) {
                    setNoAccess(true);
                    return;
                }
            } else {
                // Admin-initiated interview via sessionStorage (setup page flow)
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
                setPhase('permissions');
            }
        }
        init();
    }, [router, searchParams]);

    // =============================================
    // Permission Checks
    // =============================================
    useEffect(() => {
        if (phase !== 'permissions') return;

        async function runChecks() {
            try {
                const { checkPermissions } = await import('@/lib/recordingService');
                const result = await checkPermissions();
                setPermissions(result);
                setPermissionsChecked(true);

                if (!result.allPassed) {
                    const failed = [];
                    if (!result.camera) failed.push('Camera');
                    if (!result.microphone) failed.push('Microphone');
                    if (!result.screen) failed.push('Screen Recording');
                    setPermissionsError(`The following permissions are required: ${failed.join(', ')}. Please use Microsoft Edge or Google Chrome for the best experience.`);
                }
            } catch (e) {
                setPermissionsChecked(true);
                setPermissionsError('Failed to check permissions. Please use Microsoft Edge or Google Chrome.');
            }
        }
        runChecks();
    }, [phase]);

    // =============================================
    // Request mic permission after consent
    // =============================================
    useEffect(() => {
        if (interviewData && consentGiven) {
            getSharedMicStream()
                .catch(err => console.error('Mic permission denied:', err));
        }
    }, [interviewData, consentGiven]);

    // =============================================
    // Start camera after consent
    // =============================================
    useEffect(() => {
        async function startCamera() {
            try {
                const stream = await getSharedCameraStream();
                streamRef.current = stream;
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
            // Only detach UI stream, don't stop tracks to prevent breaking active mediaStore recordings
            if (videoRef.current?.srcObject) {
                videoRef.current.srcObject = null;
            }
        };
    }, [interviewData, consentGiven]);

    // =============================================
    // Attach camera stream when phase changes
    // =============================================
    useEffect(() => {
        const activePhases = ['ready', 'asking', 'listening', 'evaluating', 'silencePrompt', 'done'];
        if (activePhases.includes(phase) && videoRef.current && streamRef.current) {
            if (videoRef.current.srcObject !== streamRef.current) {
                videoRef.current.srcObject = streamRef.current;
                setCameraActive(true);
            }
        }
    }, [phase]);

    // =============================================
    // Real-time face detection every 1 second
    // =============================================
    useEffect(() => {
        if (!cameraActive) return;

        let detector = null;
        let useNativeDetector = false;

        async function initFaceDetector() {
            try {
                if ('FaceDetector' in window) {
                    detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
                    faceDetectorRef.current = detector;
                    useNativeDetector = true;
                }
            } catch (e) { /* fallback */ }
        }
        initFaceDetector();

        const interval = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;

            if (useNativeDetector && detector) {
                try {
                    const faces = await detector.detect(videoRef.current);
                    const count = faces.length;
                    setFaceCount(count);
                    if (count === 1) {
                        setFaceStatus('ok');
                        lastFaceSeenRef.current = Date.now();
                    } else if (count === 0) {
                        setFaceStatus('noface');
                        if (Date.now() - lastFaceSeenRef.current > 5000) {
                            addViolation('face_missing', 'No face detected for more than 5 seconds');
                            lastFaceSeenRef.current = Date.now();
                        }
                    } else {
                        setFaceStatus('multiface');
                        addViolation('multiple_faces', `${count} faces detected — only 1 allowed`);
                    }
                } catch (e) { canvasFallbackCheck(); }
            } else { canvasFallbackCheck(); }
        }, FACE_CHECK_INTERVAL);

        return () => clearInterval(interval);
    }, [cameraActive]);

    function canvasFallbackCheck() {
        if (!videoRef.current || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = 160; canvas.height = 120;
        ctx.drawImage(videoRef.current, 0, 0, 160, 120);
        const imageData = ctx.getImageData(0, 0, 160, 120);
        const data = imageData.data;
        let totalBrightness = 0;
        let pixelCount = data.length / 4;
        for (let i = 0; i < data.length; i += 16) {
            totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
        }
        const avgBrightness = totalBrightness / (pixelCount / 4);
        if (avgBrightness < 10) { setFaceStatus('noface'); setFaceCount(0); }
        else { setFaceStatus('ok'); setFaceCount(1); lastFaceSeenRef.current = Date.now(); }
    }

    function addViolation(type, message) {
        if (phaseRef.current === 'loading' || phaseRef.current === 'done' || phaseRef.current === 'permissions') return;
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
    // Handle consent and start recording
    // =============================================
    const acceptConsent = async () => {
        // Pre-initialize AudioContext
        try {
            const { warmUp } = await import('@/lib/speechService');
            await warmUp();
        } catch (e) { console.warn('Audio warm-up failed:', e); }
        setConsentGiven(true);

        // Start camera+mic recording automatically (no screen share needed)
        if (!recordingStartedRef.current) {
            recordingStartedRef.current = true;
            try {
                const { startRecording } = await import('@/lib/recordingService');
                // Pass existing camera stream if available to avoid re-acquiring
                const cameraStream = videoRef.current?.srcObject || null;
                const result = await startRecording(cameraStream);
                if (!result || !result.success) {
                    console.warn('Recording failed to start — interview continues without recording');
                } else {
                    recordingStartTimeRef.current = result.startTime;
                }
            } catch (e) {
                console.warn('Recording import failed:', e);
            }
        }

        // Create DB record
        try {
            const { createInterview, startInterviewRecord } = await import('@/lib/db');
            const iData = interviewDataRef.current;
            const record = await createInterview({
                candidateEmail: iData?.candidateEmail || 'admin-test@local',
                candidateName: iData?.candidateName || 'Admin Test',
                jobTitle: iData?.jobTitle || iData?.jobDescription?.substring(0, 100) || '',
                jobId: iData?.jobId || '',
                tokenHash: iData?.tokenHash || null,
                customQuestions: iData?.customQuestions || [],
            });
            if (record) {
                setInterviewId(record.id);
                interviewIdRef.current = record.id;
                await startInterviewRecord(record.id);
            }
        } catch (e) { console.warn('DB record creation failed:', e); }

        setPhase('ready');
    };
    useEffect(() => {
        if (phase === 'ready' && interviewData && consentGiven) {
            const t = setTimeout(() => askNextQuestion(0), 1500);
            return () => clearTimeout(t);
        }
    }, [phase, interviewData, consentGiven]);

    // =============================================
    // Ask next question (with timestamp)
    // =============================================
    const askNextQuestion = async (qIdx) => {
        if (qIdx >= maxQuestionsRef.current) { endInterview(); return; }

        // Smooth transition: fade out old question, then show new one
        if (currentQuestion) {
            setPrevQuestion(currentQuestion);
            setIsTransitioning(true);
        }
        setCurrentAnswer('');
        setPhase('asking');
        hasSpokenRef.current = false;
        currentAnswerRef.current = '';
        lastSpeechTimeRef.current = 0;
        isFollowUpRef.current = false;

        const customQs = customQuestionsRef.current;
        let questionText;
        let expectedAnswer = '';

        if (qIdx < customQs.length) {
            setProcessingMsg('Preparing question...');
            const cq = customQs[qIdx];
            questionText = typeof cq === 'string' ? cq : cq.question;
            expectedAnswer = typeof cq === 'string' ? '' : (cq.expectedAnswer || '');
        } else {
            setProcessingMsg('Generating next question...');
            try {
                const { generateQuestion } = await import('@/lib/groqService');
                const context = {
                    skillAnalysis: interviewDataRef.current.skillAnalysis,
                    questions: questionsRef.current,
                    answers: answersRef.current,
                    evaluations: evaluationsRef.current,
                    maxQuestions: maxQuestionsRef.current,
                    customQuestions: customQs.map(q => typeof q === 'string' ? q : q.question),
                    jobDescription: interviewDataRef.current.jobDescription,
                };
                const result = await generateQuestion(context);
                questionText = result.question;
                // Check if AI wants a follow-up (doesn't count toward total)
                if (result.is_follow_up) {
                    isFollowUpRef.current = true;
                    followUpCountRef.current++;
                }
            } catch (err) {
                console.error('Question generation error:', err);
                questionText = 'Could you tell me more about your experience relevant to this role?';
            }
        }

        // Complete the transition
        setCurrentQuestion(questionText);
        setIsTransitioning(false);
        setPrevQuestion('');

        questionsRef.current = [...questionsRef.current, questionText];
        setQuestionIndex(qIdx);
        questionIndexRef.current = qIdx;
        setProcessingMsg('');
        // Store expected answer and follow-up status for grading
        if (!questionsRef.current._expectedAnswers) questionsRef.current._expectedAnswers = [];
        questionsRef.current._expectedAnswers[questionsRef.current.length - 1] = expectedAnswer;
        if (!questionsRef.current._isFollowUp) questionsRef.current._isFollowUp = [];
        questionsRef.current._isFollowUp[questionsRef.current.length - 1] = isFollowUpRef.current;

        // Record timestamp for this question right before AI speaks (updated: set video start time after it speaks)
        questionTimestampsRef.current = [...questionTimestampsRef.current, {
            questionIndex: questionsRef.current.length - 1,
            question: questionText,
            askedAt: new Date().toISOString(),
            videoStartTime: null, // will be set after speak
            answeredAt: null,
            videoEndTime: null,
            isFollowUp: isFollowUpRef.current,
        }];

        try {
            const { stopListening, speak } = await import('@/lib/speechService');
            stopListening();
            setIsSpeaking(true);
            await speak(questionText);
            setIsSpeaking(false);

            // Start video snippet right as candidate is expected to answer
            const listenOffset = recordingStartTimeRef.current ? Math.max(0, (Date.now() - recordingStartTimeRef.current) / 1000) : 0;
            if (questionTimestampsRef.current[questionTimestampsRef.current.length - 1]) {
                questionTimestampsRef.current[questionTimestampsRef.current.length - 1].videoStartTime = listenOffset;
            }

            startListeningPhase();
        } catch (err) {
            console.error('Speech error:', err);
            setIsSpeaking(false);
            startListeningPhase();
        }
    };

    // =============================================
    // Start listening
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

        silenceTimerRef.current = setTimeout(() => {
            if (!hasSpokenRef.current || currentAnswerRef.current.trim().length === 0) {
                setPhase('silencePrompt');
                offerRepeat();
            }
        }, SILENCE_NO_SPEECH);
    };

    const clearAllTimers = () => {
        if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
        if (speechStoppedTimerRef.current) { clearTimeout(speechStoppedTimerRef.current); speechStoppedTimerRef.current = null; }
    };

    // =============================================
    // Global Unmount Cleanup
    // =============================================
    useEffect(() => {
        return () => {
            // Unconditionally kill all streams and STT/TTS when navigating away (like to Thank You page)
            import('@/lib/speechService').then(s => { s.stopListening(); s.stopSpeaking(); }).catch(() => { });
            import('@/lib/recordingService').then(r => r.stopRecording()).catch(() => { });
            import('@/lib/mediaStore').then(m => m.stopAllSharedStreams()).catch(() => { });

            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current = null;
            }
            if (videoRef.current?.srcObject) {
                const tracks = videoRef.current.srcObject.getTracks ? videoRef.current.srcObject.getTracks() : [];
                tracks.forEach(t => t.stop());
                videoRef.current.srcObject = null;
            }
            clearAllTimers();
        };
    }, []);

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

        // Record answer timestamp
        const endOffset = recordingStartTimeRef.current ? Math.max(0, (Date.now() - recordingStartTimeRef.current) / 1000) : 0;
        if (questionTimestampsRef.current[questionIndexRef.current]) {
            questionTimestampsRef.current[questionIndexRef.current].answeredAt = new Date().toISOString();
            questionTimestampsRef.current[questionIndexRef.current].videoEndTime = endOffset;
        }

        await processAnswer(answer);
    };

    const moveToNextQuestion = async (answer) => {
        clearAllTimers();
        const { stopListening } = await import('@/lib/speechService');
        stopListening();

        const endOffset = recordingStartTimeRef.current ? Math.max(0, (Date.now() - recordingStartTimeRef.current) / 1000) : 0;
        if (questionTimestampsRef.current[questionIndexRef.current]) {
            questionTimestampsRef.current[questionIndexRef.current].answeredAt = new Date().toISOString();
            questionTimestampsRef.current[questionIndexRef.current].videoEndTime = endOffset;
        }

        await processAnswer(answer || '[No response provided]');
    };

    // =============================================
    // Process answer
    // =============================================
    const processAnswer = async (answer) => {
        setPhase('evaluating');
        setProcessingMsg('Evaluating your answer...');
        answersRef.current = [...answersRef.current, answer];
        const currentQIdx = questionsRef.current.length - 1;
        setDisplayHistory(prev => [...prev, { question: currentQuestion, answer, score: null, isFollowUp: isFollowUpRef.current }]);

        // Get expected answer for this question (if HR provided one)
        const expectedAnswer = questionsRef.current._expectedAnswers?.[currentQIdx] || '';
        const wasFollowUp = isFollowUpRef.current;

        // Determine if this question is JD-relevant (custom questions without expected answers
        // that look non-technical get marked as not relevant)
        const isJDRelevant = true; // All questions from the interview are considered relevant

        try {
            const { evaluateAnswer } = await import('@/lib/groqService');
            const evaluation = await evaluateAnswer(currentQuestion, answer, {
                targetSkill: interviewDataRef.current.skillAnalysis?.interview_focus_areas?.[questionIndexRef.current] || '',
                jobTitle: interviewDataRef.current.skillAnalysis?.job_title || interviewDataRef.current.jobTitle || '',
                jobDescription: interviewDataRef.current.jobDescription || '',
                expectedAnswer,
                isJDRelevant,
                isCustomQuestion: currentQIdx < customQuestionsRef.current.length,
            });
            evaluation.isFollowUp = wasFollowUp;
            evaluationsRef.current = [...evaluationsRef.current, evaluation];
            setDisplayHistory(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], score: evaluation.graded !== false ? evaluation.score : null };
                return updated;
            });
            // Only show eval toast to HR, not candidates
            const isCandidateView = interviewDataRef.current?.isCandidate;
            if (!isCandidateView) {
                setShowEval(evaluation.graded !== false ? evaluation : null);
                if (evaluation.graded !== false) setTimeout(() => setShowEval(null), 3000);
            }
            setProcessingMsg('');

            // Determine next step
            // If this was a follow-up, it doesn't count toward main question progress
            if (wasFollowUp) {
                // After follow-up, continue with the next main question
                const nextMainIdx = questionIndexRef.current + 1;
                if (nextMainIdx >= maxQuestionsRef.current) { endInterview(); }
                else { await new Promise(r => setTimeout(r, 500)); askNextQuestion(nextMainIdx); }
            } else {
                // Check if AI wants to follow up on this answer
                if (evaluation.follow_up_needed && evaluation.graded !== false) {
                    // Ask a dynamic follow-up (doesn't count toward total)
                    await new Promise(r => setTimeout(r, 500));
                    await askFollowUpQuestion();
                } else {
                    const nextIdx = questionIndexRef.current + 1;
                    if (nextIdx >= maxQuestionsRef.current) { endInterview(); }
                    else { await new Promise(r => setTimeout(r, 500)); askNextQuestion(nextIdx); }
                }
            }
        } catch (err) {
            console.error('Evaluation error:', err);
            evaluationsRef.current = [...evaluationsRef.current, { score: 0, graded: true, isFollowUp: wasFollowUp }];
            setProcessingMsg('');
            if (wasFollowUp) {
                const nextMainIdx = questionIndexRef.current + 1;
                if (nextMainIdx >= maxQuestionsRef.current) { endInterview(); }
                else { askNextQuestion(nextMainIdx); }
            } else {
                const nextIdx = questionIndexRef.current + 1;
                if (nextIdx >= maxQuestionsRef.current) { endInterview(); }
                else { askNextQuestion(nextIdx); }
            }
        }
    };

    // =============================================
    // Ask a dynamic follow-up question
    // =============================================
    const askFollowUpQuestion = async () => {
        setProcessingMsg('Preparing follow-up question...');
        isFollowUpRef.current = true;
        followUpCountRef.current++;

        try {
            const { generateQuestion } = await import('@/lib/groqService');
            const context = {
                skillAnalysis: interviewDataRef.current.skillAnalysis,
                questions: questionsRef.current,
                answers: answersRef.current,
                evaluations: evaluationsRef.current,
                maxQuestions: maxQuestionsRef.current,
                customQuestions: customQuestionsRef.current.map(q => typeof q === 'string' ? q : q.question),
                jobDescription: interviewDataRef.current.jobDescription,
            };
            const result = await generateQuestion(context);
            const questionText = result.question;

            setCurrentQuestion(questionText);
            questionsRef.current = [...questionsRef.current, questionText];
            if (!questionsRef.current._expectedAnswers) questionsRef.current._expectedAnswers = [];
            questionsRef.current._expectedAnswers[questionsRef.current.length - 1] = '';
            if (!questionsRef.current._isFollowUp) questionsRef.current._isFollowUp = [];
            questionsRef.current._isFollowUp[questionsRef.current.length - 1] = true;

            questionTimestampsRef.current = [...questionTimestampsRef.current, {
                questionIndex: questionsRef.current.length - 1,
                question: questionText,
                askedAt: new Date().toISOString(),
                videoStartTime: null, // will set after speak
                answeredAt: null,
                videoEndTime: null,
                isFollowUp: true,
            }];

            setProcessingMsg('');

            const { stopListening, speak } = await import('@/lib/speechService');
            stopListening();
            setIsSpeaking(true);
            await speak(questionText);
            setIsSpeaking(false);

            // Start video snippet right as candidate is expected to answer
            const listenOffset = recordingStartTimeRef.current ? Math.max(0, (Date.now() - recordingStartTimeRef.current) / 1000) : 0;
            if (questionTimestampsRef.current[questionTimestampsRef.current.length - 1]) {
                questionTimestampsRef.current[questionTimestampsRef.current.length - 1].videoStartTime = listenOffset;
            }

            startListeningPhase();
        } catch (err) {
            console.error('Follow-up question error:', err);
            setProcessingMsg('');
            // Skip follow-up on error, proceed to next main question
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

        // Turn off camera and mic entirely
        try {
            const { stopAllSharedStreams } = await import('@/lib/mediaStore');
            stopAllSharedStreams();
        } catch (e) { }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current?.srcObject) {
            if (videoRef.current.srcObject.getTracks) {
                videoRef.current.srcObject.getTracks().forEach(t => t.stop());
            }
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);

        setPhase('processing'); // Moved from 'done' so UI hides camera definitely
        setProcessingMsg('Processing your interview...');

        // Stop recording and AWAIT the upload
        let recordingUrl = null;
        try {
            const { stopRecording } = await import('@/lib/recordingService');
            const blob = await stopRecording();
            if (blob && interviewIdRef.current) {
                setProcessingMsg('Uploading recording...');
                try {
                    const { uploadRecording } = await import('@/lib/db');
                    const url = await uploadRecording(interviewIdRef.current, blob);
                    if (url) recordingUrl = url;
                } catch (e) { console.warn('Upload failed:', e); }
            }
        } catch (e) { console.warn('Stop recording failed:', e); }

        setProcessingMsg('Generating your comprehensive report...');

        try {
            const { generateFinalReport, generateCodingProblem } = await import('@/lib/groqService');

            // Build questions with timestamps for DB
            const questionsWithTimestamps = questionsRef.current.map((q, i) => ({
                question: q,
                answer: answersRef.current[i] || '[No response]',
                score: evaluationsRef.current[i]?.score || 0,
                evaluation: evaluationsRef.current[i] || {},
                timestamp: questionTimestampsRef.current[i] || {},
            }));

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
                questionTimestamps: questionTimestampsRef.current,
                recordingUrl,
            };
            sessionStorage.setItem('visionhire_report', JSON.stringify(reportPayload));

            // Save to DB
            try {
                const { completeInterview } = await import('@/lib/db');
                if (interviewIdRef.current) {

                    // Sanitize objects before DB insertion to prevent Supabase type errors
                    const cleanQuestions = JSON.parse(JSON.stringify(questionsWithTimestamps));
                    const cleanViolations = JSON.parse(JSON.stringify(violationsRef.current));
                    const cleanReportData = JSON.parse(JSON.stringify({ ...finalReport, questionTimestamps: questionTimestampsRef.current }));
                    const cleanSkillAnalysis = JSON.parse(JSON.stringify(interviewDataRef.current.skillAnalysis || {}));

                    await completeInterview(interviewIdRef.current, {
                        questions: cleanQuestions,
                        violations: cleanViolations,
                        reportData: cleanReportData,
                        overallScore: finalReport.overall_score || 0,
                        hireRecommendation: finalReport.hire_recommendation || '',
                        recordingUrl,
                        skillAnalysis: cleanSkillAnalysis,
                    });
                }
            } catch (e) { console.warn('DB save failed:', e); }

            // Update localStorage dashboard state (candidate status -> completed with score)
            try {
                const iData = interviewDataRef.current;
                const dashData = JSON.parse(localStorage.getItem('visionhire_dashboard') || '{}');
                if (iData.candidateEmail) {
                    if (!dashData.candidates) dashData.candidates = [];
                    const existingIdx = dashData.candidates.findIndex(c => c.email === iData.candidateEmail);
                    if (existingIdx >= 0) {
                        // Update existing candidate
                        const c = dashData.candidates[existingIdx];
                        const assignments = (c.jobAssignments || []).map(a => {
                            if (a.jobId === iData.jobId || a.jobTitle === iData.jobTitle) {
                                return { ...a, status: 'completed', score: finalReport.overall_score || 0, completedAt: new Date().toISOString() };
                            }
                            return a;
                        });
                        // If no matching assignment exists, add one
                        if (!assignments.some(a => a.jobId === iData.jobId || a.jobTitle === iData.jobTitle)) {
                            assignments.push({
                                jobId: iData.jobId || '',
                                jobTitle: iData.jobTitle || '',
                                status: 'completed',
                                score: finalReport.overall_score || 0,
                                completedAt: new Date().toISOString(),
                                assignedAt: new Date().toISOString(),
                            });
                        }
                        dashData.candidates[existingIdx] = { ...c, jobAssignments: assignments, interviewStatus: 'completed' };
                    } else {
                        // Add new candidate (came via email invite, not in pool yet)
                        dashData.candidates.push({
                            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                            email: iData.candidateEmail,
                            name: iData.candidateName || '',
                            phone: '',
                            designation: '',
                            company: '',
                            addedAt: new Date().toISOString(),
                            interviewStatus: 'completed',
                            jobAssignments: [{
                                jobId: iData.jobId || '',
                                jobTitle: iData.jobTitle || '',
                                status: 'completed',
                                score: finalReport.overall_score || 0,
                                completedAt: new Date().toISOString(),
                                assignedAt: new Date().toISOString(),
                            }],
                        });
                    }
                    dashData.interviewCount = (dashData.interviewCount || 0) + 1;
                    localStorage.setItem('visionhire_dashboard', JSON.stringify(dashData));
                }
            } catch (e) { console.warn('Dashboard update failed:', e); }

            setProcessingMsg('');

            // Candidates go to thank-you page, admin goes to report
            const isCandidate = interviewDataRef.current.isCandidate;
            if (isCandidate) {
                router.push('/thankyou');
            } else if (interviewDataRef.current.includeCodingRound) {
                const codingProblem = await generateCodingProblem(interviewDataRef.current.skillAnalysis);
                sessionStorage.setItem('visionhire_coding', JSON.stringify(codingProblem));
                router.push('/coding');
            } else {
                router.push('/report');
            }
        } catch (err) {
            console.error('Report error:', err);
            setProcessingMsg('');
            const isCandidate = interviewDataRef.current.isCandidate;
            router.push(isCandidate ? '/thankyou' : '/report');
        }
    };

    // =============================================
    // Render: No Access
    // =============================================
    if (noAccess) {
        return (
            <div className={styles.processingOverlay}>
                <div style={{ textAlign: 'center', maxWidth: 480, padding: '40px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
                    <h2 style={{ color: 'var(--text-primary)', marginBottom: 12 }}>Invalid or Expired Link</h2>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        This interview link is invalid or has expired. Please contact the recruiter for a new invitation.
                    </p>
                </div>
            </div>
        );
    }

    // =============================================
    // Render: Already Completed
    // =============================================
    if (alreadyCompleted) {
        return (
            <div className={styles.processingOverlay}>
                <div style={{ textAlign: 'center', maxWidth: 480, padding: '40px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
                    <h2 style={{ color: 'var(--text-primary)', marginBottom: 12 }}>Interview Already Completed</h2>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        You have already completed this interview. Each interview can only be taken once.
                        If you believe this is an error, please contact the recruiter.
                    </p>
                </div>
            </div>
        );
    }

    // =============================================
    // Render: Loading
    // =============================================
    if (phase === 'loading' || !interviewData) {
        return (
            <div className={styles.processingOverlay}>
                <div className={styles.spinner} />
                <div className={styles.processingText}>Loading interview...</div>
            </div>
        );
    }

    // =============================================
    // Render: Permission Checks
    // =============================================
    if (phase === 'permissions') {
        return (
            <div className={styles.consentPage}>
                <div className={styles.consentCard}>
                    <div className={styles.consentIcon}>🔒</div>
                    <h1 className={styles.consentTitle}>Permission Check</h1>
                    <p className={styles.consentSubtitle}>
                        We need to verify your device capabilities before starting the interview.
                    </p>

                    <div className={styles.consentTerms}>
                        <div className={styles.consentItem}>
                            <span className={styles.consentBullet} style={{ fontSize: '1.5rem' }}>
                                {permissions.camera === null ? '⏳' : permissions.camera ? '✅' : '❌'}
                            </span>
                            <div>
                                <strong>Camera</strong>
                                <p>{permissions.camera === null ? 'Checking...' : permissions.camera ? 'Camera access granted' : 'Camera access denied'}</p>
                            </div>
                        </div>
                        <div className={styles.consentItem}>
                            <span className={styles.consentBullet} style={{ fontSize: '1.5rem' }}>
                                {permissions.microphone === null ? '⏳' : permissions.microphone ? '✅' : '❌'}
                            </span>
                            <div>
                                <strong>Microphone</strong>
                                <p>{permissions.microphone === null ? 'Checking...' : permissions.microphone ? 'Microphone access granted' : 'Microphone access denied'}</p>
                            </div>
                        </div>
                        <div className={styles.consentItem}>
                            <span className={styles.consentBullet} style={{ fontSize: '1.5rem' }}>
                                {permissions.screen === null ? '⏳' : permissions.screen ? '✅' : '❌'}
                            </span>
                            <div>
                                <strong>Screen Recording</strong>
                                <p>{permissions.screen === null ? 'Checking...' : permissions.screen ? 'Screen recording supported' : 'Screen recording not supported'}</p>
                            </div>
                        </div>
                    </div>

                    {permissionsChecked && permissionsError && (
                        <div className={styles.consentWarning} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: 16 }}>
                            ⚠️ {permissionsError}
                            <div style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                💡 <strong>Tip:</strong> For best results, use <strong>Microsoft Edge</strong> or <strong>Google Chrome</strong> on a desktop computer.
                            </div>
                        </div>
                    )}

                    {permissionsChecked && permissions.allPassed && (
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 12, padding: '16px 20px', marginBottom: 16, color: 'var(--accent-success)', fontSize: '0.9rem' }}>
                            ✅ All permissions verified! You're ready to proceed.
                        </div>
                    )}

                    <div className={styles.consentActions}>
                        <button
                            className={styles.consentAccept}
                            onClick={() => setPhase('consent')}
                            disabled={!permissionsChecked || !permissions.allPassed}
                            style={!permissionsChecked || !permissions.allPassed ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                        >
                            {!permissionsChecked ? 'Checking Permissions...' : permissions.allPassed ? 'Continue →' : 'Permissions Required'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // =============================================
    // Render: Consent
    // =============================================
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
                            <span className={styles.consentBullet}>🎥</span>
                            <div>
                                <strong>Video Recording</strong>
                                <p>Your camera and microphone will be recorded during the interview for review purposes.</p>
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
                        ⚠️ By clicking &ldquo;I Accept &amp; Begin Interview&rdquo; below, you consent to camera monitoring, video recording, and proctoring throughout this session.
                    </div>
                    <div className={styles.consentActions}>
                        <button className={styles.consentDecline} onClick={() => {
                            if (tokenData) window.close();
                            else router.push('/setup');
                        }}>Decline</button>
                        <button className={styles.consentAccept} onClick={acceptConsent}>I Accept &amp; Begin Interview</button>
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className={styles.interviewPage}>
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Top Bar */}
            <div className={styles.topBar}>
                <div className={styles.topBarLeft}>
                    <div className={styles.logo}>
                        <div className={styles.logoIcon}>⚡</div>
                        Hyper<span style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Hire</span>
                    </div>
                    <div className={`${styles.statusBadge} ${styles.statusLive}`}>
                        <div className={styles.statusDot} />
                        Interview Live
                    </div>
                    {recordingStartedRef.current && (
                        <div className={`${styles.statusBadge}`} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                            <div className={styles.statusDot} style={{ background: '#ef4444' }} />
                            REC
                        </div>
                    )}
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
                            <div className={styles.avatarName}>HyperHire Interviewer</div>
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
                                {item.score !== null && !interviewDataRef.current?.isCandidate && <div className={styles.transcriptScore}>Score: {item.score}/10</div>}
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

export default function InterviewPage() {
    return (
        <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div className="spinner" style={{ width: 40, height: 40, border: '3px solid var(--border-subtle)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                    Loading...
                </div>
            </div>
        }>
            <InterviewContent />
        </Suspense>
    );
}
