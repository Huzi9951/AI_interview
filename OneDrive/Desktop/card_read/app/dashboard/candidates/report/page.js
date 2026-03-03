'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './report.module.css';

function ReportContent() {
    const searchParams = useSearchParams();
    const [interviews, setInterviews] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const email = searchParams.get('email');
    const interviewId = searchParams.get('id');

    useEffect(() => {
        async function load() {
            try {
                if (interviewId) {
                    const res = await fetch(`/api/interviews/${interviewId}`);
                    const data = await res.json();
                    if (data.interview) {
                        setSelected(data.interview);
                        setInterviews([data.interview]);
                    } else {
                        setError('Interview not found.');
                    }
                } else if (email) {
                    const res = await fetch(`/api/interviews?email=${encodeURIComponent(email)}`);
                    const data = await res.json();
                    setInterviews(data.interviews || []);
                    if (data.interviews?.length === 1) setSelected(data.interviews[0]);
                } else {
                    setError('No candidate specified.');
                }
            } catch (e) {
                setError('Failed to load interview data.');
            }
            setLoading(false);
        }
        load();
    }, [email, interviewId]);

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingCard}>
                    <div className={styles.spinner} />
                    <p>Loading interview data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.errorCard}>
                    <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚠️</div>
                    <h2>{error}</h2>
                </div>
            </div>
        );
    }

    if (!selected && interviews.length > 0) {
        return (
            <div className={styles.container}>
                <h1 className={styles.pageTitle}>Interview Reports for {email}</h1>
                <div className={styles.interviewList}>
                    {interviews.map(iv => (
                        <div key={iv.id} className={styles.interviewCard} onClick={() => setSelected(iv)}>
                            <div className={styles.ivHeader}>
                                <span className={styles.ivJob}>{iv.job_title || 'Untitled'}</span>
                                <span className={`${styles.ivStatus} ${iv.status === 'completed' ? styles.ivCompleted : styles.ivPending}`}>
                                    {iv.status}
                                </span>
                            </div>
                            <div className={styles.ivMeta}>
                                <span>Score: {iv.overall_score || '—'}/100</span>
                                <span>{iv.completed_at ? new Date(iv.completed_at).toLocaleDateString() : 'In progress'}</span>
                            </div>
                            {iv.hire_recommendation && (
                                <div className={styles.ivRec}>{iv.hire_recommendation}</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!selected) {
        return (
            <div className={styles.container}>
                <div className={styles.errorCard}>
                    <div style={{ fontSize: '2rem', marginBottom: 12 }}>📋</div>
                    <h2>No interviews found for this candidate.</h2>
                </div>
            </div>
        );
    }

    const report = selected.report_data || {};
    const questions = selected.questions || [];
    const violations = selected.violations || [];
    const timestamps = report.questionTimestamps || [];

    return (
        <div className={styles.container}>
            {interviews.length > 1 && (
                <button className={styles.backBtn} onClick={() => setSelected(null)}>
                    ← Back to all interviews
                </button>
            )}

            {/* Header */}
            <div className={styles.reportHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Interview Report</h1>
                    <p className={styles.subtitle}>
                        {selected.candidate_name || selected.candidate_email} • {selected.job_title}
                    </p>
                </div>
                <div className={styles.headerMeta}>
                    <span>Started: {selected.started_at ? new Date(selected.started_at).toLocaleString() : '—'}</span>
                    <span>Completed: {selected.completed_at ? new Date(selected.completed_at).toLocaleString() : '—'}</span>
                </div>
            </div>

            {/* Score Hero */}
            <div className={styles.scoreSection}>
                <div className={styles.scoreCircle}>
                    <div className={styles.scoreNumber}>{selected.overall_score || 0}</div>
                    <div className={styles.scoreLabel}>/ 100</div>
                </div>
                <div className={styles.recBadge} data-rec={selected.hire_recommendation?.toLowerCase()?.replace(/\s+/g, '-')}>
                    {selected.hire_recommendation === 'Strong Yes' ? '🌟' : selected.hire_recommendation === 'Yes' ? '✅' : selected.hire_recommendation === 'Maybe' ? '🤔' : '❌'}
                    {' '}{selected.hire_recommendation || 'Pending'}
                </div>
            </div>

            {/* Justification */}
            {report.justification && (
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>📝 Justification</h2>
                    <div className={styles.glass}>{report.justification}</div>
                </div>
            )}

            {/* Strengths & Concerns */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>💪 Strengths & Concerns</h2>
                <div className={styles.swGrid}>
                    <div className={styles.glass}>
                        <h3 style={{ color: 'var(--accent-success)', marginBottom: 12 }}>✅ Top Strengths</h3>
                        <ul className={styles.bulletList}>
                            {(report.top_strengths || []).map((s, i) => <li key={i}>{s}</li>)}
                            {(!report.top_strengths || !report.top_strengths.length) && <li style={{ color: 'var(--text-muted)' }}>No data</li>}
                        </ul>
                    </div>
                    <div className={styles.glass}>
                        <h3 style={{ color: 'var(--accent-danger)', marginBottom: 12 }}>⚠️ Concerns</h3>
                        <ul className={styles.bulletList}>
                            {(report.major_concerns || []).map((c, i) => <li key={i}>{c}</li>)}
                            {(!report.major_concerns || !report.major_concerns.length) && <li style={{ color: 'var(--text-muted)' }}>None flagged</li>}
                        </ul>
                    </div>
                </div>
            </div>

            {/* Questions with timestamps */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>📊 Question-by-Question Breakdown</h2>
                <div className={styles.questionList}>
                    {questions.map((q, i) => {
                        const ts = q.timestamp || timestamps[i] || {};
                        const eval_ = q.evaluation || {};
                        return (
                            <div key={i} className={styles.questionCard}>
                                <div className={styles.qHeader}>
                                    <span className={styles.qNum}>Q{i + 1}</span>
                                    <span className={styles.qScore}>{q.score || 0}/10</span>
                                </div>
                                <div className={styles.qText}>{q.question || q}</div>
                                <div className={styles.qAnswer}>
                                    <strong>Answer:</strong> {q.answer || '[No response]'}
                                </div>
                                {(ts.askedAt || ts.answeredAt) && (
                                    <div className={styles.qTimestamp}>
                                        ⏱ Asked: {ts.askedAt ? new Date(ts.askedAt).toLocaleTimeString() : '—'}
                                        {ts.answeredAt && ` → Answered: ${new Date(ts.answeredAt).toLocaleTimeString()}`}
                                    </div>
                                )}
                                <div className={styles.qMeta}>
                                    <span>Depth: {eval_.technical_depth || 0}/10</span>
                                    <span>Clarity: {eval_.clarity || 0}/10</span>
                                    <span>Relevance: {eval_.relevance || 0}/10</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Violations with timestamps */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>🛡️ Violations ({violations.length})</h2>
                {violations.length === 0 ? (
                    <div className={styles.glass} style={{ textAlign: 'center', padding: 24, color: 'var(--accent-success)' }}>
                        ✅ No violations recorded
                    </div>
                ) : (
                    <div className={styles.violationList}>
                        {violations.map((v, i) => (
                            <div key={i} className={styles.violationItem}>
                                <span className={styles.violationType}>{v.type}</span>
                                <span className={styles.violationMsg}>{v.message}</span>
                                <span className={styles.violationTime}>
                                    {v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : '—'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Recording */}
            {selected.recording_url && (
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>🎬 Interview Recording</h2>
                    <div className={styles.glass}>
                        <video controls style={{ width: '100%', borderRadius: 8 }} src={selected.recording_url}>
                            Your browser does not support the video tag.
                        </video>
                        <a href={selected.recording_url} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-block', marginTop: 12, color: 'var(--text-accent)', fontSize: '0.85rem' }}>
                            📥 Download Recording
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function CandidateReportPage() {
    return (
        <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>
            </div>
        }>
            <ReportContent />
        </Suspense>
    );
}
