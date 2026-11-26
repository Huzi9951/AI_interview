import React from 'react';
import styles from './AnalysisModal.module.css';

export default function AnalysisModal({ isOpen, onClose, analysis, candidateName }) {
    if (!isOpen || !analysis) return null;

    const {
        job_title,
        overall_match_score,
        skill_matches = [],
        skill_gaps = [],
        key_strengths = [],
        key_concerns = [],
        interview_focus_areas = []
    } = analysis;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.title}>Deep Match Analysis</h2>
                        <p className={styles.subtitle}>{candidateName} • {job_title}</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>

                <div className={styles.body}>
                    <div className={styles.scoreSection}>
                        <div className={styles.scoreCircle}>
                            <span className={styles.scoreValue}>{overall_match_score}%</span>
                            <span className={styles.scoreLabel}>Match</span>
                        </div>
                        <div className={styles.scoreInfo}>
                            <h3>AI Conclusion</h3>
                            <p>This candidate shows a {overall_match_score}% alignment with the core requirements of the role.</p>
                        </div>
                    </div>

                    <div className={styles.grid}>
                        <div className={styles.card}>
                            <h4 className={styles.cardTitle}>✅ Key Strengths</h4>
                            <ul className={styles.list}>
                                {key_strengths.map((s, i) => <li key={i}>{s}</li>)}
                                {key_strengths.length === 0 && <li>No specific strengths identified.</li>}
                            </ul>
                        </div>

                        <div className={styles.card}>
                            <h4 className={styles.cardTitle}>⚠️ Key Concerns</h4>
                            <ul className={styles.list}>
                                {key_concerns.map((c, i) => <li key={i}>{c}</li>)}
                                {key_concerns.length === 0 && <li>No major concerns identified.</li>}
                            </ul>
                        </div>

                        <div className={styles.card}>
                            <h4 className={styles.cardTitle}>🎯 Skill Matches</h4>
                            <div className={styles.tagGroup}>
                                {skill_matches.map((s, i) => <span key={i} className={styles.tagMatch}>{s}</span>)}
                                {skill_matches.length === 0 && <span className={styles.emptyTag}>None found</span>}
                            </div>
                        </div>

                        <div className={styles.card}>
                            <h4 className={styles.cardTitle}>🧩 Skill Gaps</h4>
                            <div className={styles.tagGroup}>
                                {skill_gaps.map((s, i) => <span key={i} className={styles.tagGap}>{s}</span>)}
                                {skill_gaps.length === 0 && <span className={styles.emptyTag}>None identified</span>}
                            </div>
                        </div>
                    </div>

                    <div className={styles.focusSection}>
                        <h4 className={styles.cardTitle}>💡 Interview Focus Areas</h4>
                        <ul className={styles.focusList}>
                            {interview_focus_areas.map((a, i) => <li key={i}>{a}</li>)}
                        </ul>
                    </div>
                </div>

                <div className={styles.footer}>
                    <button className={styles.doneBtn} onClick={onClose}>Done</button>
                </div>
            </div>
        </div>
    );
}
