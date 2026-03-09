'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import styles from './page.module.css';

// Dynamically import Monaco to avoid SSR issues
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const CODING_TIME_LIMIT = 600; // 10 minutes in seconds

export default function CodingPage() {
    const router = useRouter();
    const [problem, setProblem] = useState(null);
    const [code, setCode] = useState('// Write your solution here\n\n');
    const [language] = useState('javascript');
    const [timeLeft, setTimeLeft] = useState(CODING_TIME_LIMIT);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Proctoring
    const [copyAttempts, setCopyAttempts] = useState(0);
    const [focusLosses, setFocusLosses] = useState(0);
    const [keystrokes, setKeystrokes] = useState(0);

    // Load problem
    useEffect(() => {
        const data = sessionStorage.getItem('hypereval_coding');
        if (!data) {
            router.push('/report');
            return;
        }
        setProblem(JSON.parse(data));
    }, [router]);

    // Timer
    useEffect(() => {
        if (!problem) return;
        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    handleSubmit();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [problem]);

    // Copy-paste detection
    useEffect(() => {
        const handlePaste = (e) => {
            e.preventDefault();
            setCopyAttempts((p) => p + 1);
        };
        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, []);

    // Focus loss detection
    useEffect(() => {
        const handleBlur = () => setFocusLosses((p) => p + 1);
        window.addEventListener('blur', handleBlur);
        return () => window.removeEventListener('blur', handleBlur);
    }, []);

    // Keystroke tracking
    useEffect(() => {
        const handleKey = () => setKeystrokes((p) => p + 1);
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, []);

    const formatTime = (s) => {
        const min = Math.floor(s / 60);
        const sec = s % 60;
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    const handleSubmit = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const { evaluateCode } = await import('@/lib/groqService');
            const evaluation = await evaluateCode(problem, code, language);

            // Store evaluation
            const reportData = JSON.parse(sessionStorage.getItem('hypereval_report') || '{}');
            reportData.codingEvaluation = evaluation;
            reportData.codingSubmission = {
                code,
                language,
                timeUsed: CODING_TIME_LIMIT - timeLeft,
                keystrokes,
                copyAttempts,
                focusLosses,
            };
            sessionStorage.setItem('hypereval_report', JSON.stringify(reportData));

            router.push('/report');
        } catch (err) {
            console.error('Code evaluation error:', err);
            router.push('/report');
        }
    };

    if (!problem) {
        return (
            <div className={styles.loadingOverlay}>
                <div className={styles.spinner} />
                <div className={styles.loadingText}>Loading coding challenge...</div>
            </div>
        );
    }

    return (
        <div className={styles.codingPage}>
            {/* Top Bar */}
            <div className={styles.topBar}>
                <div className={styles.topBarLeft}>
                    <div className={styles.logo}>
                        <div className={styles.logoIcon}>⚡</div>
                        HyperEval
                    </div>
                    <span className={styles.badge}>💻 Coding Round</span>
                </div>
                <div className={styles.topBarRight}>
                    <span className={`${styles.timer} ${timeLeft < 120 ? styles.timerWarn : ''}`}>
                        ⏱ {formatTime(timeLeft)}
                    </span>
                    <button className={styles.submitBtn} onClick={handleSubmit} id="submit-code-btn">
                        ✓ Submit Code
                    </button>
                </div>
            </div>

            {/* Main */}
            <div className={styles.mainContent}>
                {/* Problem Panel */}
                <div className={styles.problemPanel}>
                    <h2 className={styles.problemTitle}>{problem.title}</h2>
                    <span className={`${styles.difficultyBadge} ${styles[`diff${problem.difficulty?.charAt(0).toUpperCase() + problem.difficulty?.slice(1)}`] || styles.diffMedium}`}>
                        {problem.difficulty || 'Medium'}
                    </span>
                    <div className={styles.problemDesc}>{problem.description}</div>

                    {problem.test_cases && (
                        <div className={styles.testCases}>
                            <div className={styles.testCaseTitle}>Test Cases</div>
                            {problem.test_cases.map((tc, i) => (
                                <div key={i} className={styles.testCase}>
                                    <div className={styles.testLabel}>Input:</div>
                                    <div className={styles.testValue}>{tc.input}</div>
                                    <div className={styles.testLabel} style={{ marginTop: '8px' }}>Expected:</div>
                                    <div className={styles.testValue}>{tc.expected_output}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Editor */}
                <div className={styles.editorPanel}>
                    <div className={styles.editorHeader}>
                        <span className={styles.langBadge}>📝 {language}</span>
                        <div className={styles.editorWarnings}>
                            <span className={`${styles.warningItem} ${copyAttempts > 0 ? styles.warningActive : ''}`}>
                                📋 Copy attempts: {copyAttempts}
                            </span>
                            <span className={`${styles.warningItem} ${focusLosses > 0 ? styles.warningActive : ''}`}>
                                👁 Focus losses: {focusLosses}
                            </span>
                            <span className={styles.warningItem}>
                                ⌨ Keystrokes: {keystrokes}
                            </span>
                        </div>
                    </div>
                    <div className={styles.editorWrapper}>
                        <MonacoEditor
                            height="100%"
                            language={language}
                            theme="vs-dark"
                            value={code}
                            onChange={(val) => setCode(val || '')}
                            options={{
                                minimap: { enabled: false },
                                fontSize: 14,
                                fontFamily: "'JetBrains Mono', monospace",
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                tabSize: 2,
                            }}
                        />
                    </div>
                </div>
            </div>

            {isSubmitting && (
                <div className={styles.loadingOverlay}>
                    <div className={styles.spinner} />
                    <div className={styles.loadingText}>Evaluating your code...</div>
                </div>
            )}
        </div>
    );
}
