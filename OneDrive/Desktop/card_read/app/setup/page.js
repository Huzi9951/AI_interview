'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

export default function SetupPage() {
    const router = useRouter();
    const fileInputRef = useRef(null);

    const [jd, setJd] = useState('');
    const [resumeFile, setResumeFile] = useState(null);
    const [resumeText, setResumeText] = useState('');
    const [includeCoding, setIncludeCoding] = useState(false);
    const [questionCount, setQuestionCount] = useState(6);
    const [customQuestions, setCustomQuestions] = useState([]);
    const [newQuestion, setNewQuestion] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteSent, setInviteSent] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [fromInvite, setFromInvite] = useState(false);

    // Auto-fill from invite link
    useEffect(() => {
        try {
            const inviteRaw = sessionStorage.getItem('hypereval_invite');
            if (inviteRaw) {
                const invite = JSON.parse(inviteRaw);
                if (invite.fromInvite) {
                    setFromInvite(true);
                    if (invite.jobDescription) setJd(invite.jobDescription);
                    if (invite.customQuestions?.length) setCustomQuestions(invite.customQuestions);
                }
                sessionStorage.removeItem('hypereval_invite');
            }
        } catch (e) { /* ignore */ }
    }, []);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setResumeFile(file);

        try {
            const { extractTextFromPDF } = await import('@/lib/resumeParser');
            const text = await extractTextFromPDF(file);
            setResumeText(text);
        } catch (err) {
            console.error('PDF parsing error:', err);
            alert('Failed to parse PDF. Please try another file.');
        }
    };

    const handleSubmit = async () => {
        if (!jd.trim() || !resumeText.trim()) return;

        setIsLoading(true);
        setLoadingMessage('Analyzing job description and resume...');

        try {
            const { analyzeJDAndResume } = await import('@/lib/groqService');
            const skillAnalysis = await analyzeJDAndResume(jd, resumeText);

            setLoadingMessage('Preparing interview...');

            // Store data in sessionStorage for the interview page
            const interviewData = {
                jobDescription: jd,
                resumeText,
                resumeFileName: resumeFile?.name || 'resume.pdf',
                skillAnalysis,
                includeCodingRound: includeCoding,
                questionCount,
                customQuestions: customQuestions.filter(q => q.trim().length > 0),
            };
            sessionStorage.setItem('hypereval_setup', JSON.stringify(interviewData));

            router.push('/interview');
        } catch (err) {
            console.error('Analysis error:', err);
            alert('Failed to analyze. Please check your Groq API key and try again.');
            setIsLoading(false);
        }
    };

    const addCustomQuestion = () => {
        const q = newQuestion.trim();
        if (!q) return;
        setCustomQuestions(prev => [...prev, q]);
        setNewQuestion('');
    };

    const removeCustomQuestion = (index) => {
        setCustomQuestions(prev => prev.filter((_, i) => i !== index));
    };

    const handleSendInvite = () => {
        if (!inviteEmail.trim()) return;
        const interviewLink = `${window.location.origin}/interview`;
        // Copy link to clipboard
        navigator.clipboard?.writeText(interviewLink).catch(() => { });
        setInviteSent(true);
        setTimeout(() => setInviteSent(false), 4000);
    };

    const isReady = jd.trim().length > 20 && resumeText.trim().length > 10;

    return (
        <div className={styles.setupPage}>
            <div className={styles.bgOrbs}>
                <div className={`${styles.orb} ${styles.orb1}`} />
                <div className={`${styles.orb} ${styles.orb2}`} />
            </div>

            {/* Header */}
            <header className={styles.header}>
                <Link href="/" className={styles.logo}>
                    <div className={styles.logoIcon}>⚡</div>
                    <span>Hyper<span className={styles.logoGradient}>Hire</span></span>
                </Link>
                <div className={styles.stepBadge}>📋 Step 1: Setup</div>
            </header>

            {/* Content */}
            <main className={styles.content}>
                <h1 className={styles.pageTitle}>Set Up Your Interview</h1>
                <p className={styles.pageSubtitle}>
                    Provide the job description and candidate resume. Our AI will analyze both to create a personalized interview.
                </p>

                <div className={styles.grid}>
                    {/* Left: JD */}
                    <div className={`glass-card ${styles.card}`}>
                        <div className={styles.cardTitle}>
                            <div className={styles.cardIcon}>📄</div>
                            Job Description
                        </div>
                        <textarea
                            className={styles.textarea}
                            placeholder="Paste the full job description here...&#10;&#10;Include required skills, responsibilities, experience level, and any other relevant details."
                            value={jd}
                            onChange={(e) => setJd(e.target.value)}
                            id="jd-input"
                        />
                    </div>

                    {/* Right: Resume + Config */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div className={`glass-card ${styles.card}`}>
                            <div className={styles.cardTitle}>
                                <div className={styles.cardIcon}>📎</div>
                                Candidate Resume
                            </div>
                            <div
                                className={`${styles.uploadArea} ${resumeFile ? styles.uploadAreaActive : ''}`}
                                onClick={() => fileInputRef.current?.click()}
                                id="resume-upload"
                            >
                                <div className={styles.uploadIcon}>
                                    {resumeFile ? '✅' : '📁'}
                                </div>
                                <div className={styles.uploadText}>
                                    {resumeFile ? (
                                        <>Resume uploaded successfully</>
                                    ) : (
                                        <>
                                            Click to upload or <strong>drag & drop</strong>
                                            <br />
                                            PDF files only
                                        </>
                                    )}
                                </div>
                                {resumeFile && (
                                    <div className={styles.uploadFileName}>
                                        📄 {resumeFile.name}
                                    </div>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf"
                                    className={styles.fileInput}
                                    onChange={handleFileChange}
                                />
                            </div>
                        </div>

                        <div className={`glass-card ${styles.card}`}>
                            <div className={styles.cardTitle}>
                                <div className={styles.cardIcon}>⚙️</div>
                                Interview Settings
                            </div>
                            <div className={styles.toggleRow}>
                                <div className={styles.toggleLabel}>
                                    <span className={styles.toggleName}>❓ Number of Questions</span>
                                    <span className={styles.toggleDesc}>How many questions to ask (default: 6)</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <button
                                        style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-glass)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        onClick={() => setQuestionCount(Math.max(2, questionCount - 1))}
                                    >−</button>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 700, minWidth: '28px', textAlign: 'center', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{questionCount}</span>
                                    <button
                                        style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-glass)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        onClick={() => setQuestionCount(Math.min(10, questionCount + 1))}
                                    >+</button>
                                </div>
                            </div>
                            <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '4px' }} />
                            <div className={styles.toggleRow}>
                                <div className={styles.toggleLabel}>
                                    <span className={styles.toggleName}>💻 Coding Round</span>
                                    <span className={styles.toggleDesc}>Include a short coding challenge</span>
                                </div>
                                <button
                                    className={`${styles.toggle} ${includeCoding ? styles.toggleActive : ''}`}
                                    onClick={() => setIncludeCoding(!includeCoding)}
                                    id="coding-toggle"
                                />
                            </div>
                        </div>

                        {/* Custom Questions */}
                        <div className={`glass-card ${styles.card}`}>
                            <div className={styles.cardTitle}>
                                <div className={styles.cardIcon}>📝</div>
                                Custom Questions
                                <span className={styles.optionalBadge}>Optional</span>
                            </div>
                            <p className={styles.cardDesc}>
                                Add specific questions you want the AI to ask during the interview.
                            </p>
                            <div className={styles.addQuestionRow}>
                                <input
                                    type="text"
                                    className={styles.questionInput}
                                    placeholder="Type a custom question..."
                                    value={newQuestion}
                                    onChange={(e) => setNewQuestion(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addCustomQuestion()}
                                    id="custom-question-input"
                                />
                                <button
                                    className={styles.addQuestionBtn}
                                    onClick={addCustomQuestion}
                                    disabled={!newQuestion.trim()}
                                >
                                    + Add
                                </button>
                            </div>
                            {customQuestions.length > 0 && (
                                <div className={styles.questionList}>
                                    {customQuestions.map((q, i) => (
                                        <div key={i} className={styles.questionItem}>
                                            <span className={styles.questionItemNum}>{i + 1}.</span>
                                            <span className={styles.questionItemText}>{q}</span>
                                            <button
                                                className={styles.removeQuestionBtn}
                                                onClick={() => removeCustomQuestion(i)}
                                                title="Remove question"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Email Invite */}
                        <div className={`glass-card ${styles.card}`}>
                            <div className={styles.cardTitle}>
                                <div className={styles.cardIcon}>✉️</div>
                                Invite Candidate
                                <span className={styles.optionalBadge}>Optional</span>
                            </div>
                            <p className={styles.cardDesc}>
                                Send an interview invitation email with a direct link to the interview.
                            </p>
                            <div className={styles.addQuestionRow}>
                                <input
                                    type="email"
                                    className={styles.questionInput}
                                    placeholder="candidate@email.com"
                                    value={inviteEmail}
                                    onChange={(e) => { setInviteEmail(e.target.value); setInviteSent(false); }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
                                    id="invite-email-input"
                                />
                                <button
                                    className={`${styles.addQuestionBtn} ${inviteSent ? styles.sentBtn : ''}`}
                                    onClick={handleSendInvite}
                                    disabled={!inviteEmail.trim() || inviteSent}
                                >
                                    {inviteSent ? '✓ Sent' : '🚀 Send'}
                                </button>
                            </div>
                            {inviteSent && (
                                <div className={styles.inviteSuccess}>
                                    ✅ Invitation link copied to clipboard! Share this link with the candidate.
                                    <div className={styles.inviteLink}>
                                        {typeof window !== 'undefined' ? `${window.location.origin}/interview` : '/interview'}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Submit */}
                <div className={styles.submitSection}>
                    <button
                        className={`btn-primary ${styles.submitBtn}`}
                        onClick={handleSubmit}
                        disabled={!isReady || isLoading}
                        id="start-interview-btn"
                    >
                        🚀 Begin Interview
                    </button>
                    {!isReady && (
                        <p style={{ color: 'var(--text-muted)', marginTop: '12px', fontSize: '0.85rem' }}>
                            Please provide both a job description and a resume to continue
                        </p>
                    )}
                </div>
            </main>

            {/* Loading Overlay */}
            {isLoading && (
                <div className={styles.loadingOverlay}>
                    <div className={styles.spinner} />
                    <div className={styles.loadingText}>{loadingMessage}</div>
                </div>
            )}
        </div>
    );
}
