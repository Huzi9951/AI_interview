'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

function ReportContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [reportData, setReportData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadReport() {
            // 1. Try sessionStorage first (just-completed interview)
            const data = sessionStorage.getItem('hypereval_report');
            if (data) {
                const parsed = JSON.parse(data);
                setReportData(parsed);
                setIsLoading(false);
                return;
            }

            // 2. Try loading from DB via query param
            const interviewId = searchParams.get('id');
            if (interviewId) {
                try {
                    const res = await fetch(`/api/interviews/${interviewId}`);
                    const result = await res.json();
                    if (result.success && result.interview) {
                        const iv = result.interview;
                        const report = iv.report_data || {};
                        const formattedData = {
                            finalReport: report,
                            questions: (iv.questions || []).map(q => q.question || q),
                            answers: (iv.questions || []).map(q => q.answer || '[No response]'),
                            evaluations: (iv.questions || []).map(q => q.evaluation || {}),
                            violations: iv.violations || [],
                            codingEvaluation: report.codingEvaluation || null,
                            skillAnalysis: iv.skill_analysis || {},
                            questionTimestamps: report.questionTimestamps || (iv.questions || []).map(q => q.timestamp || {}),
                            recordingUrl: iv.recording_url || null,
                            jobDescription: iv.job_title || '',
                            resumeFileName: '',
                        };
                        setReportData(formattedData);
                        setIsLoading(false);
                        return;
                    }
                } catch (err) {
                    console.error('Failed to load report from DB:', err);
                }
            }

            // 3. No data found — redirect to setup
            router.push('/setup');
        }
        loadReport();
    }, [router, searchParams]);

    if (isLoading || !reportData) {
        return (
            <div className={styles.loadingOverlay}>
                <div className={styles.spinner} />
                <div className={styles.loadingText}>Loading report...</div>
            </div>
        );
    }

    const report = reportData.finalReport || {};
    const questions = reportData.questions || [];
    const answers = reportData.answers || [];
    const evaluations = reportData.evaluations || [];
    const violations = reportData.violations || [];
    const codingEval = reportData.codingEvaluation;
    const skillAnalysis = reportData.skillAnalysis || {};

    const overallScore = report.overall_score || 0;
    const recommendation = report.hire_recommendation || 'N/A';

    const getRecClass = (rec) => {
        const r = rec.toLowerCase();
        if (r.includes('strong yes')) return styles.recStrongYes;
        if (r.includes('yes')) return styles.recYes;
        if (r.includes('maybe')) return styles.recMaybe;
        return styles.recNo;
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className={styles.reportPage}>
            <div className={styles.bgOrbs}>
                <div className={`${styles.orb} ${styles.orb1}`} />
                <div className={`${styles.orb} ${styles.orb2}`} />
            </div>

            {/* Header */}
            <header className={styles.header}>
                <Link href="/" className={styles.logo}>
                    <div className={styles.logoIcon}>⚡</div>
                    <span>Vision<span className={styles.logoGradient}>Hire</span> AI</span>
                </Link>
                <div className={styles.headerActions}>
                    <button className={styles.printBtn} onClick={handlePrint}>
                        🖨 Print Report
                    </button>
                    <Link href="/setup" className="btn-primary" style={{ padding: '10px 24px', fontSize: '0.9rem' }}>
                        🔄 New Interview
                    </Link>
                </div>
            </header>

            <main className={styles.content}>
                {/* Score Hero */}
                <div className={styles.scoreHero}>
                    <div className={styles.scoreTitle}>Interview Evaluation Report</div>
                    <div className={styles.scoreCircle}>
                        <div className={styles.scoreNumber}>{overallScore}</div>
                        <div className={styles.scoreOutOf}>out of 100</div>
                    </div>
                    <div className={`${styles.recommendation} ${getRecClass(recommendation)}`}>
                        {recommendation === 'Strong Yes' ? '🌟' : recommendation === 'Yes' ? '✅' : recommendation === 'Maybe' ? '🤔' : '❌'}
                        {' '}{recommendation}
                    </div>
                </div>

                {/* Justification */}
                {report.justification && (
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}>📝 Justification</h2>
                        <div className={`glass-card ${styles.justification}`}>
                            {report.justification}
                        </div>
                    </div>
                )}

                {/* Strengths & Concerns */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>💪 Strengths & Concerns</h2>
                    <div className={styles.swGrid}>
                        <div className={`glass-card ${styles.swCard}`}>
                            <div className={styles.swTitle}>✅ Top Strengths</div>
                            <ul className={styles.swList}>
                                {(report.top_strengths || []).map((s, i) => (
                                    <li key={i} className={`${styles.swItem} ${styles.strengthItem}`}>{s}</li>
                                ))}
                                {(!report.top_strengths || report.top_strengths.length === 0) && (
                                    <li className={styles.swItem} style={{ borderLeftColor: 'var(--text-muted)' }}>No data available</li>
                                )}
                            </ul>
                        </div>
                        <div className={`glass-card ${styles.swCard}`}>
                            <div className={styles.swTitle}>⚠️ Major Concerns</div>
                            <ul className={styles.swList}>
                                {(report.major_concerns || []).map((c, i) => (
                                    <li key={i} className={`${styles.swItem} ${styles.weaknessItem}`}>{c}</li>
                                ))}
                                {(!report.major_concerns || report.major_concerns.length === 0) && (
                                    <li className={styles.swItem} style={{ borderLeftColor: 'var(--text-muted)' }}>No concerns flagged</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Per-Question Breakdown */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>📊 Per-Question Breakdown</h2>
                    <div className={styles.questionGrid}>
                        {questions.map((q, i) => {
                            const eval_ = evaluations[i] || {};
                            const ts = reportData?.questionTimestamps?.[i] || {};
                            const isGraded = eval_.graded !== false;
                            const isFollowUp = eval_.isFollowUp || false;
                            return (
                                <div key={i} className={`glass-card ${styles.questionCard}`}>
                                    <div className={styles.qHeader}>
                                        <span className={styles.qNumber}>
                                            Question {i + 1}
                                            {isFollowUp && <span style={{ marginLeft: 8, background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', fontSize: '0.7rem', padding: '2px 8px', borderRadius: 6 }}>Follow-up</span>}
                                            {!isGraded && <span style={{ marginLeft: 8, background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', fontSize: '0.7rem', padding: '2px 8px', borderRadius: 6 }}>Not Graded</span>}
                                        </span>
                                        <span className={styles.qScore}>{isGraded ? `${eval_.score || 0}/10` : '—'}</span>
                                    </div>
                                    <div className={styles.qText}>{q}</div>
                                    <div className={styles.qAnswer}>
                                        <strong>Answer:</strong> {answers[i] || '[No response]'}
                                    </div>
                                    {(ts.askedAt || ts.answeredAt) && (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                                            ⏱ Asked: {ts.askedAt ? new Date(ts.askedAt).toLocaleTimeString() : '—'}
                                            {ts.answeredAt && ` → Answered: ${new Date(ts.answeredAt).toLocaleTimeString()}`}
                                        </div>
                                    )}
                                    {reportData.recordingUrl && typeof ts.videoStartTime === 'number' && typeof ts.videoEndTime === 'number' && (
                                        <div style={{ marginTop: 12, marginBottom: 12 }}>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                                                📹 Response Recording
                                            </div>
                                            <video
                                                controls
                                                playsInline
                                                style={{ width: '100%', borderRadius: 8, maxHeight: 240, objectFit: 'cover', background: '#000' }}
                                                src={`${reportData.recordingUrl}#t=${Math.max(0, ts.videoStartTime)},${ts.videoEndTime}`}
                                            >
                                                Your browser does not support the video tag.
                                            </video>
                                        </div>
                                    )}
                                    {isGraded && (
                                        <>
                                            <div className={styles.qMeta}>
                                                <span className={styles.qMetaItem}>Depth: {eval_.technical_depth || 0}/10</span>
                                                <span className={styles.qMetaItem}>Clarity: {eval_.clarity || 0}/10</span>
                                                <span className={styles.qMetaItem}>Relevance: {eval_.relevance || 0}/10</span>
                                                <span className={styles.qMetaItem}>Confidence: {eval_.confidence_estimate || 0}/10</span>
                                            </div>
                                            {eval_.strengths && eval_.strengths.length > 0 && (
                                                <div style={{ marginTop: '12px', fontSize: '0.85rem' }}>
                                                    <span style={{ color: 'var(--accent-success)' }}>✓ Strengths: </span>
                                                    <span style={{ color: 'var(--text-secondary)' }}>{eval_.strengths.join(', ')}</span>
                                                </div>
                                            )}
                                            {eval_.weaknesses && eval_.weaknesses.length > 0 && (
                                                <div style={{ marginTop: '4px', fontSize: '0.85rem' }}>
                                                    <span style={{ color: 'var(--accent-danger)' }}>✗ Weaknesses: </span>
                                                    <span style={{ color: 'var(--text-secondary)' }}>{eval_.weaknesses.join(', ')}</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {!isGraded && eval_.detailed_feedback && (
                                        <div style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                            {eval_.detailed_feedback}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Skill Assessment */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>🎯 Skill Assessment</h2>
                    <div className={styles.skillsGrid}>
                        <div className={`glass-card ${styles.skillCard}`}>
                            <div className={styles.skillCardTitle}>✅ Demonstrated Skills</div>
                            <div className={styles.skillTags}>
                                {(report.skill_assessment?.demonstrated_skills || skillAnalysis.skill_matches || []).map((s, i) => (
                                    <span key={i} className={`${styles.skillTag} ${styles.skillDemo}`}>{s}</span>
                                ))}
                            </div>
                        </div>
                        <div className={`glass-card ${styles.skillCard}`}>
                            <div className={styles.skillCardTitle}>🟡 Unverified Skills</div>
                            <div className={styles.skillTags}>
                                {(report.skill_assessment?.unverified_skills || []).map((s, i) => (
                                    <span key={i} className={`${styles.skillTag} ${styles.skillUnver}`}>{s}</span>
                                ))}
                            </div>
                        </div>
                        <div className={`glass-card ${styles.skillCard}`}>
                            <div className={styles.skillCardTitle}>🔴 Skill Gaps</div>
                            <div className={styles.skillTags}>
                                {(report.skill_assessment?.concerning_gaps || skillAnalysis.skill_gaps || []).map((s, i) => (
                                    <span key={i} className={`${styles.skillTag} ${styles.skillGap}`}>{s}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Coding Evaluation */}
                {codingEval && (
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}>💻 Coding Evaluation</h2>
                        <div className={`glass-card ${styles.codingSection}`}>
                            <div className={styles.codingScores}>
                                <div className={styles.codingScoreItem}>
                                    <div className={styles.codingScoreValue}>{codingEval.correctness || 0}</div>
                                    <div className={styles.codingScoreLabel}>Correctness</div>
                                </div>
                                <div className={styles.codingScoreItem}>
                                    <div className={styles.codingScoreValue}>{codingEval.time_complexity_score || 0}</div>
                                    <div className={styles.codingScoreLabel}>Time Complexity</div>
                                </div>
                                <div className={styles.codingScoreItem}>
                                    <div className={styles.codingScoreValue}>{codingEval.code_quality || 0}</div>
                                    <div className={styles.codingScoreLabel}>Code Quality</div>
                                </div>
                                <div className={styles.codingScoreItem}>
                                    <div className={styles.codingScoreValue}>{codingEval.edge_case_handling || 0}</div>
                                    <div className={styles.codingScoreLabel}>Edge Cases</div>
                                </div>
                                <div className={styles.codingScoreItem}>
                                    <div className={styles.codingScoreValue}>{codingEval.overall_score || 0}</div>
                                    <div className={styles.codingScoreLabel}>Overall</div>
                                </div>
                            </div>
                            {codingEval.feedback && (
                                <div style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                                    <strong>Feedback:</strong> {codingEval.feedback}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Violations */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>🛡️ Proctoring Summary</h2>
                    <div className={`glass-card ${styles.violationsSummary}`}>
                        <div className={styles.violationRow}>
                            <span>Total Violations</span>
                            <span className={styles.violationCount}>{violations.length}</span>
                        </div>
                        <div className={styles.violationRow}>
                            <span>Tab Switches</span>
                            <span className={styles.violationCount}>{violations.filter(v => v.type === 'tab_switch').length}</span>
                        </div>
                        <div className={styles.violationRow}>
                            <span>Focus Losses</span>
                            <span className={styles.violationCount}>{violations.filter(v => v.type === 'focus_loss').length}</span>
                        </div>
                        <div className={styles.violationRow}>
                            <span>Impact on Score</span>
                            <span className={styles.violationCount}>{report.violation_summary?.impact_on_score || 'none'}</span>
                        </div>
                    </div>
                </div>

                {/* Recording */}
                {reportData.recordingUrl && (
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}>🎬 Full Interview Recording</h2>
                        <div className={`glass-card ${styles.swCard}`}>
                            <video controls style={{ width: '100%', borderRadius: 8 }} src={reportData.recordingUrl}>
                                Your browser does not support the video tag.
                            </video>
                            <a href={reportData.recordingUrl} target="_blank" rel="noopener noreferrer"
                                style={{ display: 'inline-block', marginTop: 12, color: 'var(--text-accent)', fontSize: '0.85rem' }}>
                                📥 Download Recording
                            </a>
                        </div>
                    </div>
                )}

                {/* Risk Flags */}
                {report.risk_flags && report.risk_flags.length > 0 && (
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}>🚩 Risk Flags</h2>
                        <div className={`glass-card ${styles.swCard}`}>
                            <ul className={styles.swList}>
                                {report.risk_flags.map((f, i) => (
                                    <li key={i} className={`${styles.swItem} ${styles.weaknessItem}`}>{f}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {/* Next Round Focus */}
                {report.suggested_next_round_focus && report.suggested_next_round_focus.length > 0 && (
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}>🎯 Suggested Next Round Focus</h2>
                        <div className={`glass-card ${styles.swCard}`}>
                            <ul className={styles.swList}>
                                {report.suggested_next_round_focus.map((f, i) => (
                                    <li key={i} className={`${styles.swItem} ${styles.strengthItem}`}>{f}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function ReportPage() {
    return (
        <Suspense fallback={
            <div className={styles.loadingOverlay}>
                <div className={styles.spinner} />
                <div className={styles.loadingText}>Loading report...</div>
            </div>
        }>
            <ReportContent />
        </Suspense>
    );
}
