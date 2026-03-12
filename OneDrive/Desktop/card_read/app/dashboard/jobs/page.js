'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useDashboard } from '@/context/DashboardContext';
import styles from './jobs.module.css';

export default function JobsPage() {
    const { state, dispatch, unassignFromJob, assignToJob, updateMatchScore } = useDashboard();
    const [selectedJob, setSelectedJob] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('details'); // details | candidates
    const [statusFilter, setStatusFilter] = useState('all'); // all | assigned | invited | awaiting_review | accepted | rejected

    // Modals
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [assignSelection, setAssignSelection] = useState(new Set());

    // Invite modal state (with question preview)
    const [inviteCandidate, setInviteCandidate] = useState(null);
    const [inviteExpiryHours, setInviteExpiryHours] = useState(48);
    const [inviteStep, setInviteStep] = useState(1); // 1=settings, 2=custom questions, 3=preview, 4=sending
    const [inviteQuestions, setInviteQuestions] = useState([{ question: '', expectedAnswer: '' }]);
    const [previewQuestions, setPreviewQuestions] = useState([]);
    const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
    const [inviteSending, setInviteSending] = useState(false);
    const [isDeletingJob, setIsDeletingJob] = useState(false);

    const [toast, setToast] = useState('');

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

    const filtered = state.jobs.filter(j =>
        j.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.location.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const daysSince = (dateStr) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const days = Math.floor(diff / 86400000);
        if (days === 0) return 'Today';
        if (days === 1) return '1 day ago';
        if (days < 30) return `${days} days ago`;
        return `${Math.floor(days / 30)} month(s) ago`;
    };

    const getJobCandidates = (jobId) => {
        return state.candidates.filter(c =>
            (c.jobAssignments || []).some(a => a.jobId === jobId)
        ).map(c => {
            const assignment = c.jobAssignments.find(a => a.jobId === jobId);
            return {
                ...c,
                jobStatus: assignment?.status || 'assigned',
                jobScore: assignment?.score,
                matchScore: assignment?.matchScore // AI Resume Match Score
            };
        });
    };

    const getUnassignedCandidates = () => {
        return state.candidates.filter(c =>
            !c.jobAssignments || c.jobAssignments.length === 0
        );
    };

    const handleAssign = async () => {
        if (assignSelection.size === 0 || !selectedJob) return;

        const candidateIds = Array.from(assignSelection);
        await assignToJob(assignSelection, selectedJob.id, selectedJob.title);

        showToast(`✓ Assigned ${candidateIds.length} candidate(s) to ${selectedJob.title}`);
        setShowAssignModal(false);
        setAssignSelection(new Set());

        // Trigger AI Resume Matching
        const { analyzeJDAndResume } = await import('@/lib/groqService');
        const jd = `${selectedJob.title}\n${selectedJob.description}\n${(selectedJob.skills || []).join(', ')}`;

        candidateIds.forEach(async (id) => {
            const candidate = state.candidates.find(c => c.id === id);
            if (candidate && candidate.resumeText) {
                try {
                    const result = await analyzeJDAndResume(jd, candidate.resumeText);
                    if (result && result.overall_match_score !== undefined) {
                        await updateMatchScore(id, selectedJob.id, result.overall_match_score);
                    }
                } catch (err) {
                    console.error(`Match analysis failed for ${candidate.email}:`, err);
                }
            }
        });
    };

    // ── Open single invite modal (with question preview) ──
    const openInviteFor = (candidate) => {
        if (candidate.jobStatus === 'invited') {
            if (!confirm(`An invite was already sent to ${candidate.name || candidate.email} for this role. Are you sure you want to send another one?`)) {
                return;
            }
        }

        setInviteCandidate(candidate);
        setInviteExpiryHours(48);
        setInviteStep(1);
        setInviteQuestions([{ question: '', expectedAnswer: '' }]);
        setPreviewQuestions([]);
        setShowInviteModal(true);
    };

    // ── Generate AI questions for preview ──
    const generateQuestionsForPreview = async () => {
        if (!selectedJob) return;
        setIsGeneratingQuestions(true);
        try {
            const { generateInterviewQuestions } = await import('@/lib/groqService');
            const result = await generateInterviewQuestions(selectedJob.description || selectedJob.title);
            const aiQuestions = (result.questions || []).map(q => ({
                question: q.question,
                expectedAnswer: '',
                target_skill: q.target_skill || '',
                source: 'ai',
            }));
            const manualQs = inviteQuestions.filter(q => q.question.trim()).map(q => ({
                question: q.question,
                expectedAnswer: q.expectedAnswer || '',
                target_skill: '',
                source: 'manual',
            }));
            setPreviewQuestions([...manualQs, ...aiQuestions]);
        } catch (err) {
            console.error('Failed to generate questions:', err);
            showToast('⚠ Failed to generate AI questions.');
            const manualQs = inviteQuestions.filter(q => q.question.trim()).map(q => ({
                question: q.question,
                expectedAnswer: q.expectedAnswer || '',
                target_skill: '',
                source: 'manual',
            }));
            setPreviewQuestions(manualQs);
        }
        setIsGeneratingQuestions(false);
    };

    const moveQuestion = (idx, direction) => {
        const newQ = [...previewQuestions];
        const swapIdx = idx + direction;
        if (swapIdx < 0 || swapIdx >= newQ.length) return;
        [newQ[idx], newQ[swapIdx]] = [newQ[swapIdx], newQ[idx]];
        setPreviewQuestions(newQ);
    };

    // ── Send invite via API ──
    const handleSendInvite = async () => {
        if (!inviteCandidate || !selectedJob) return;
        setInviteStep(4);
        setInviteSending(true);

        try {
            const questionsPayload = previewQuestions.map(q => ({
                question: q.question,
                expectedAnswer: q.expectedAnswer || '',
            }));

            const res = await fetch('/api/send-invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    candidates: [{ 
                        email: inviteCandidate.email, 
                        name: inviteCandidate.name,
                        resumeText: inviteCandidate.resumeText || '',
                        matchScore: inviteCandidate.matchScore || 0,
                    }],
                    jobTitle: selectedJob.title,
                    jobId: selectedJob.id,
                    jobDescription: selectedJob.description || '',
                    expiryHours: inviteExpiryHours,
                    customQuestions: questionsPayload,
                    questionCount: previewQuestions.length,
                }),
            });

            const data = await res.json();

            if (data.success) {
                dispatch({
                    type: 'UPDATE_CANDIDATE_JOB_STATUS',
                    payload: { candidateId: inviteCandidate.id, jobId: selectedJob.id, status: 'invited' },
                });
                showToast(`✓ Invite sent to ${inviteCandidate.name || inviteCandidate.email}!`);
            } else {
                showToast(`⚠ Failed: ${data.error || 'Unknown error'}`);
            }
        } catch (err) {
            showToast(`⚠ Error sending invite: ${err.message}`);
        } finally {
            setInviteSending(false);
            setShowInviteModal(false);
        }
    };

    const handleStatusUpdate = (candidateId, newStatus) => {
        dispatch({
            type: 'UPDATE_CANDIDATE_JOB_STATUS',
            payload: { candidateId, jobId: selectedJob.id, status: newStatus },
        });
        showToast(`✓ Candidate ${newStatus}`);
    };

    const toggleAssign = (id) => {
        setAssignSelection(prev => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    };

    const baseJobCandidates = selectedJob ? getJobCandidates(selectedJob.id) : [];
    const jobCandidates = statusFilter === 'all'
        ? baseJobCandidates
        : baseJobCandidates.filter(c => {
            if (statusFilter === 'awaiting_review') {
                return c.jobStatus === 'completed' || c.jobStatus === 'interviewed';
            }
            return c.jobStatus === statusFilter;
        });

    const statusBadge = (status, score) => {
        const map = {
            assigned: { label: '📋 Assigned', cls: styles.badgeAssigned },
            invited: { label: '📧 Invited', cls: styles.badgeInvited },
            completed: { label: `✅ Completed${score != null ? ` (${score}/100)` : ''}`, cls: styles.badgeInterviewed },
            interviewed: { label: '✅ Interviewed', cls: styles.badgeInterviewed },
            accepted: { label: '🎉 Accepted', cls: styles.badgeAccepted },
            rejected: { label: '❌ Rejected', cls: styles.badgeRejected },
        };
        const s = map[status] || map.assigned;
        return <span className={`${styles.candidateStatusBadge} ${s.cls}`}>{s.label}</span>;
    };

    return (
        <div className={styles.jobsPage}>
            <div className={styles.jobsHeader}>
                <h1 className={styles.jobsTitle}>Jobs</h1>
                <Link href="/dashboard/jobs/create" className={styles.createJobBtn}>+ Create Job</Link>
            </div>

            <div className={styles.jobsContent}>
                {/* Left Panel */}
                <div className={styles.jobsList}>
                    <div className={styles.searchBar}>
                        <span className={styles.searchIcon}>🔍</span>
                        <input className={styles.searchInput} placeholder="Search jobs..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>
                    {filtered.map(job => (
                        <div key={job.id}
                            className={`${styles.jobItem} ${selectedJob?.id === job.id ? styles.jobItemActive : ''}`}
                            onClick={() => { setSelectedJob(job); setActiveTab('details'); }}>
                            <div className={styles.jobItemHeader}>
                                <h3 className={styles.jobItemTitle}>{job.title}</h3>
                                <span className={`${styles.jobBadge} ${job.status === 'open' ? styles.badgeOpen : styles.badgeClosed}`}>
                                    {job.status === 'open' ? 'OPEN' : 'CLOSED'}
                                </span>
                            </div>
                            <div className={styles.jobItemMeta}>
                                <span>📍 {job.locationType} • {job.location}</span>
                                <span>📊 {job.experienceLevel} • {job.experienceRange}</span>
                            </div>
                            <div className={styles.jobItemFooter}>
                                <span>⏱ {daysSince(job.createdAt)}</span>
                                <span>👥 {getJobCandidates(job.id).length} candidates</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right Panel */}
                <div className={styles.jobDetail}>
                    {selectedJob ? (
                        <>
                            <div className={styles.detailHeader}>
                                <h2 className={styles.detailTitle}>{selectedJob.title}</h2>
                                <div className={styles.detailActions}>
                                    <button className={`${styles.statusToggle} ${selectedJob.status === 'open' ? styles.statusOpen : styles.statusClosed}`}
                                        onClick={() => dispatch({ type: 'TOGGLE_JOB_STATUS', payload: selectedJob.id })}>
                                        {selectedJob.status === 'open' ? '🟢 Open' : '🔴 Closed'}
                                    </button>
                                    <button className={styles.deleteBtn} disabled={isDeletingJob} onClick={async () => {
                                        if (confirm('Are you absolutely sure you want to delete this job? ALL associated candidate assignments, interview records, and video recordings across the system will be permanently deleted.')) {
                                            setIsDeletingJob(true);
                                            try {
                                                const { deleteJobDataCompletely } = await import('@/lib/db');
                                                await deleteJobDataCompletely(selectedJob.id);

                                                dispatch({ type: 'DELETE_JOB', payload: selectedJob.id });
                                                setSelectedJob(null);
                                                showToast('✓ Job and all associated data deleted completely');
                                            } catch (err) {
                                                console.error(err);
                                                showToast('⚠ Failed to wipe all associated Job data.');
                                            } finally {
                                                setIsDeletingJob(false);
                                            }
                                        }
                                    }}>
                                        {isDeletingJob ? '🗑️...' : '🗑️'}
                                    </button>
                                </div>
                            </div>

                            <div className={styles.tabBar}>
                                <button className={`${styles.tab} ${activeTab === 'details' ? styles.tabActive : ''}`}
                                    onClick={() => setActiveTab('details')}>Details</button>
                                <button className={`${styles.tab} ${activeTab === 'candidates' ? styles.tabActive : ''}`}
                                    onClick={() => setActiveTab('candidates')}>
                                    Candidates ({jobCandidates.length})
                                </button>
                            </div>

                            {/* Details Tab */}
                            {activeTab === 'details' && (
                                <>
                                    <div className={styles.detailMeta}>
                                        <div className={styles.metaItem}><span className={styles.metaLabel}>Location</span><span className={styles.metaValue}>{selectedJob.locationType} • {selectedJob.location}</span></div>
                                        <div className={styles.metaItem}><span className={styles.metaLabel}>Experience</span><span className={styles.metaValue}>{selectedJob.experienceLevel} • {selectedJob.experienceRange}</span></div>
                                        <div className={styles.metaItem}><span className={styles.metaLabel}>Type</span><span className={styles.metaValue}>{selectedJob.employmentType}</span></div>
                                        <div className={styles.metaItem}><span className={styles.metaLabel}>Department</span><span className={styles.metaValue}>{selectedJob.department || '—'}</span></div>
                                    </div>
                                    {selectedJob.skills?.length > 0 && (
                                        <div className={styles.detailSection}><h3 className={styles.sectionTitle}>Skills</h3>
                                            <div className={styles.tagList}>{selectedJob.skills.map(s => <span key={s} className={styles.tag}>{s}</span>)}</div>
                                        </div>
                                    )}
                                    {selectedJob.description && (
                                        <div className={styles.detailSection}><h3 className={styles.sectionTitle}>Description</h3><p className={styles.sectionText}>{selectedJob.description}</p></div>
                                    )}
                                    {selectedJob.mustHave?.length > 0 && (
                                        <div className={styles.detailSection}><h3 className={styles.sectionTitle}>Must Have</h3>
                                            <ul className={styles.criteriaList}>{selectedJob.mustHave.map((item, i) => <li key={i} className={styles.criteriaItem}>{item}</li>)}</ul>
                                        </div>
                                    )}
                                    {selectedJob.preferred?.length > 0 && (
                                        <div className={styles.detailSection}><h3 className={styles.sectionTitle}>Preferred</h3>
                                            <ul className={styles.criteriaList}>{selectedJob.preferred.map((item, i) => <li key={i} className={styles.criteriaItem}>{item}</li>)}</ul>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Candidates Tab */}
                            {activeTab === 'candidates' && (
                                <>
                                    <div className={styles.candidatesToolbar}>
                                        <button className={styles.assignBtn} onClick={() => { setAssignSelection(new Set()); setShowAssignModal(true); }}>
                                            + Assign Candidates
                                        </button>
                                        <select
                                            value={statusFilter}
                                            onChange={e => setStatusFilter(e.target.value)}
                                            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e8e8ef', fontSize: '0.85rem', color: '#1a1a2e', outline: 'none' }}
                                        >
                                            <option value="all">All Statuses</option>
                                            <option value="assigned">Assigned</option>
                                            <option value="invited">Invited</option>
                                            <option value="awaiting_review">Awaiting Review</option>
                                            <option value="accepted">Accepted</option>
                                            <option value="rejected">Rejected</option>
                                        </select>
                                    </div>

                                    {jobCandidates.length === 0 ? (
                                        <div className={styles.emptyCandidates}>
                                            <div className={styles.emptyIcon}>👥</div>
                                            <p>No candidates assigned yet. Click &quot;Assign Candidates&quot; to add from your pool.</p>
                                        </div>
                                    ) : (
                                        <div className={styles.candidatesTable}>
                                            <table className={styles.cTable}>
                                                <thead>
                                                    <tr>
                                                        <th>Candidate</th>
                                                        <th>Contact</th>
                                                        <th>Match Score</th>
                                                        <th>Status</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {jobCandidates.map(c => (
                                                        <tr key={c.id}>
                                                            <td>
                                                                <div className={styles.cName}>{c.name || '—'}</div>
                                                                {c.designation && <div className={styles.cRole}>{c.designation}</div>}
                                                            </td>
                                                            <td>
                                                                <div className={styles.cEmail}>{c.email}</div>
                                                                {c.phone && <div className={styles.cPhone}>{c.phone}</div>}
                                                            </td>
                                                            <td>
                                                                {c.matchScore !== undefined && c.matchScore !== null ? (
                                                                    <div className={styles.matchScoreWrapper}>
                                                                        <div className={styles.matchScoreBar}>
                                                                            <div className={styles.matchScoreFill} style={{
                                                                                width: `${c.matchScore}%`,
                                                                                backgroundColor: c.matchScore > 75 ? '#22c55e' : c.matchScore > 50 ? '#eab308' : '#ef4444'
                                                                            }} />
                                                                        </div>
                                                                        <span className={styles.matchScoreText}>{c.matchScore}% Match</span>
                                                                    </div>
                                                                ) : (
                                                                    <span className={styles.noResume}>No Resume</span>
                                                                )}
                                                            </td>
                                                            <td>{statusBadge(c.jobStatus, c.jobScore)}</td>
                                                            <td>
                                                                    <div className={styles.cActions}>
                                                                        {(c.jobStatus === 'assigned') && (
                                                                            <button className={styles.actionSend} onClick={() => openInviteFor(c)}>
                                                                                📧 Send Invite
                                                                            </button>
                                                                        )}
                                                                        {c.jobStatus === 'invited' && (
                                                                            <>
                                                                                <span className={styles.actionWaiting} style={{ marginRight: 8 }}>⏳ Awaiting</span>
                                                                                <button className={styles.actionSend} onClick={() => openInviteFor(c)}>
                                                                                    📧 Resend Invite
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                        {(c.jobStatus === 'completed' || c.jobStatus === 'interviewed') && (
                                                                            <>
                                                                                <button className={styles.actionAccept} onClick={() => handleStatusUpdate(c.id, 'accepted')}>✅ Accept</button>
                                                                                <button className={styles.actionReject} onClick={() => handleStatusUpdate(c.id, 'rejected')}>❌ Reject</button>
                                                                            </>
                                                                        )}
                                                                        {(c.jobStatus === 'completed' || c.jobStatus === 'interviewed' || c.jobStatus === 'accepted' || c.jobStatus === 'rejected') && (
                                                                            <Link href={`/dashboard/candidates/report?email=${encodeURIComponent(c.email)}`}
                                                                                className={styles.actionAnalytics}>
                                                                                📊 Analytics
                                                                            </Link>
                                                                        )}
                                                                        
                                                                        {/* Unassign button */}
                                                                        <button 
                                                                            className={styles.actionUnassign} 
                                                                            onClick={() => {
                                                                                if (confirm(`Are you sure you want to unassign ${c.name || c.email} from this job?`)) {
                                                                                    unassignFromJob(c.id, selectedJob.id);
                                                                                    showToast(`✓ Candidate unassigned`);
                                                                                }
                                                                            }}
                                                                            title="Unassign from this job"
                                                                        >
                                                                            🚫 Unassign
                                                                        </button>
                                                                    </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    ) : (
                        <div className={styles.emptyDetail}>
                            <div className={styles.emptyIcon}>📋</div>
                            <h3 className={styles.emptyTitle}>Welcome to Jobs Management</h3>
                            <p className={styles.emptyDesc}>Select a job from the list to view details or create a new one.</p>
                            <Link href="/dashboard/jobs/create" className={styles.createJobBtnSmall}>+ Create Job</Link>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══════════ Assign Candidates Modal ═══════════ */}
            {showAssignModal && selectedJob && (
                <div className={styles.modalOverlay} onClick={() => setShowAssignModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2 className={styles.modalTitle}>Assign Candidates</h2>
                                <p className={styles.modalSubtitle}>Select candidates from the pool for <strong>{selectedJob.title}</strong></p>
                            </div>
                            <button className={styles.modalClose} onClick={() => setShowAssignModal(false)}>×</button>
                        </div>
                        <div className={styles.modalBody}>
                            {getUnassignedCandidates().length === 0 ? (
                                <div className={styles.modalEmpty}>
                                    <p>No unassigned candidates. Add candidates from the <Link href="/dashboard/candidates" style={{ color: '#e8604c', fontWeight: 600 }}>Candidates page</Link> first.</p>
                                </div>
                            ) : (
                                <>
                                    <div className={styles.modalSelectAll}>
                                        <label className={styles.modalCheckLabel}>
                                            <input type="checkbox" className={styles.modalCheckbox}
                                                checked={assignSelection.size === getUnassignedCandidates().length && assignSelection.size > 0}
                                                onChange={() => {
                                                    const all = getUnassignedCandidates().map(c => c.id);
                                                    setAssignSelection(assignSelection.size === all.length ? new Set() : new Set(all));
                                                }} />
                                            Select All ({getUnassignedCandidates().length})
                                        </label>
                                        <span className={styles.modalSelectedCount}>{assignSelection.size} selected</span>
                                    </div>
                                    <div className={styles.modalCandidateList}>
                                        {getUnassignedCandidates().map(c => (
                                            <label key={c.id} className={styles.modalCandidateRow}>
                                                <input type="checkbox" className={styles.modalCheckbox}
                                                    checked={assignSelection.has(c.id)}
                                                    onChange={() => toggleAssign(c.id)} />
                                                <div className={styles.modalCandidateInfo}>
                                                    <span className={styles.modalCandidateName}>{c.name || c.email}</span>
                                                    {c.name && <span className={styles.modalCandidateEmail}>{c.email}</span>}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.modalCancel} onClick={() => setShowAssignModal(false)}>Cancel</button>
                            <button className={styles.modalSend} disabled={assignSelection.size === 0} onClick={handleAssign}>
                                Assign ({assignSelection.size})
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════ Send Invite Modal (with Question Preview) ═══════════ */}
            {showInviteModal && inviteCandidate && selectedJob && (
                <div className={styles.modalOverlay} onClick={() => setShowInviteModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2 className={styles.modalTitle}>
                                    {inviteStep === 1 && 'Invite Settings'}
                                    {inviteStep === 2 && 'Custom Questions'}
                                    {inviteStep === 3 && 'Review & Edit Questions'}
                                    {inviteStep === 4 && 'Sending...'}
                                </h2>
                                <p className={styles.modalSubtitle}>
                                    to <strong>{inviteCandidate.name || inviteCandidate.email}</strong> for <strong>{selectedJob.title}</strong>
                                    {inviteStep < 4 && ` • Step ${inviteStep} of 3`}
                                </p>
                            </div>
                            <button className={styles.modalClose} onClick={() => setShowInviteModal(false)}>×</button>
                        </div>
                        <div className={styles.modalBody}>
                            {/* STEP 1: Settings */}
                            {inviteStep === 1 && (
                                <div style={{ padding: 24 }}>
                                    <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1a1a2e', display: 'block', marginBottom: 8 }}>Invite Expiry</label>
                                    <div className={styles.expiryRow}>
                                        <input type="number" className={styles.expiryInput}
                                            value={inviteExpiryHours} min={1} max={720}
                                            onChange={e => setInviteExpiryHours(Number(e.target.value))} />
                                        <span className={styles.expiryUnit}>hours</span>
                                        <div className={styles.expiryPresets}>
                                            {[24, 48, 72, 168].map(h => (
                                                <button key={h} className={`${styles.expiryPreset} ${inviteExpiryHours === h ? styles.expiryPresetActive : ''}`}
                                                    onClick={() => setInviteExpiryHours(h)}>
                                                    {h < 48 ? '24h' : h < 72 ? '48h' : h < 168 ? '72h' : '1 week'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: Custom Questions */}
                            {inviteStep === 2 && (
                                <div style={{ padding: 24 }}>
                                    <p style={{ fontSize: '0.88rem', color: '#6b7280', marginBottom: 16, lineHeight: 1.5 }}>
                                        Add custom questions with optional expected answers (for grading):
                                    </p>
                                    {inviteQuestions.map((q, i) => (
                                        <div key={i} style={{ marginBottom: 12, background: '#f8f9fa', border: '1px solid #e8e8ef', borderRadius: 10, padding: '12px 14px' }}>
                                            <div className={styles.modalQuestionRow}>
                                                <input className={styles.modalQuestionInput} placeholder={`Question ${i + 1}...`}
                                                    value={q.question} onChange={e => setInviteQuestions(prev => prev.map((v, j) => j === i ? { ...v, question: e.target.value } : v))} />
                                                {inviteQuestions.length > 1 && (
                                                    <button className={styles.modalQuestionRemove}
                                                        onClick={() => setInviteQuestions(prev => prev.filter((_, j) => j !== i))}>×</button>
                                                )}
                                            </div>
                                            <input className={styles.modalQuestionInput}
                                                placeholder="Expected answer (optional — used for grading)"
                                                style={{ marginTop: 6, fontSize: '0.82rem', opacity: 0.8 }}
                                                value={q.expectedAnswer}
                                                onChange={e => setInviteQuestions(prev => prev.map((v, j) => j === i ? { ...v, expectedAnswer: e.target.value } : v))} />
                                        </div>
                                    ))}
                                    <button className={styles.modalAddQuestion}
                                        onClick={() => setInviteQuestions(prev => [...prev, { question: '', expectedAnswer: '' }])}>+ Add Question</button>
                                </div>
                            )}

                            {/* STEP 3: Preview & Edit */}
                            {inviteStep === 3 && (
                                <div style={{ padding: 24 }}>
                                    {isGeneratingQuestions ? (
                                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                            <div style={{ width: 48, height: 48, border: '4px solid #e8e8ef', borderTopColor: '#e8604c', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                                            <p style={{ color: '#9ca3af' }}>Generating AI questions from job description...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <p style={{ fontSize: '0.88rem', color: '#6b7280', marginBottom: 16, lineHeight: 1.5 }}>
                                                Review, edit, and reorder the interview questions:
                                            </p>
                                            {previewQuestions.length === 0 ? (
                                                <div style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>No questions. Go back to add custom questions.</div>
                                            ) : (
                                                <div style={{ maxHeight: 350, overflowY: 'auto' }}>
                                                    {previewQuestions.map((q, i) => (
                                                        <div key={i} style={{
                                                            background: '#f8f9fa', border: '1px solid #e8e8ef',
                                                            borderRadius: 10, padding: '12px 14px', marginBottom: 10,
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                                <span style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: 700, minWidth: 20 }}>{i + 1}.</span>
                                                                <span style={{
                                                                    background: q.source === 'ai' ? '#eef2ff' : '#fef2f0',
                                                                    color: q.source === 'ai' ? '#6366f1' : '#e8604c',
                                                                    fontSize: '0.7rem', padding: '2px 8px', borderRadius: 6, fontWeight: 600,
                                                                }}>
                                                                    {q.source === 'ai' ? '🤖 AI' : '✏️ Manual'}
                                                                </span>
                                                                {q.target_skill && (
                                                                    <span style={{ color: '#9ca3af', fontSize: '0.72rem' }}>• {q.target_skill}</span>
                                                                )}
                                                                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                                                                    <button onClick={() => moveQuestion(i, -1)} disabled={i === 0}
                                                                        style={{ background: 'none', border: '1px solid #e8e8ef', color: '#6b7280', borderRadius: 6, width: 28, height: 28, cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1, fontSize: '0.8rem' }}>↑</button>
                                                                    <button onClick={() => moveQuestion(i, 1)} disabled={i === previewQuestions.length - 1}
                                                                        style={{ background: 'none', border: '1px solid #e8e8ef', color: '#6b7280', borderRadius: 6, width: 28, height: 28, cursor: i === previewQuestions.length - 1 ? 'default' : 'pointer', opacity: i === previewQuestions.length - 1 ? 0.3 : 1, fontSize: '0.8rem' }}>↓</button>
                                                                    <button onClick={() => setPreviewQuestions(prev => prev.filter((_, j) => j !== i))}
                                                                        style={{ background: 'none', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: '0.8rem' }}>×</button>
                                                                </div>
                                                            </div>
                                                            <textarea
                                                                style={{
                                                                    width: '100%', background: '#fff', border: '1px solid #e8e8ef',
                                                                    borderRadius: 8, color: '#1a1a2e', padding: '8px 10px',
                                                                    fontSize: '0.88rem', resize: 'vertical', minHeight: 42, fontFamily: 'inherit',
                                                                }}
                                                                value={q.question}
                                                                onChange={e => setPreviewQuestions(prev => prev.map((v, j) => j === i ? { ...v, question: e.target.value } : v))}
                                                            />
                                                            <input
                                                                style={{
                                                                    width: '100%', background: '#fff', border: '1px solid #e8e8ef',
                                                                    borderRadius: 8, color: '#6b7280', padding: '6px 10px',
                                                                    fontSize: '0.8rem', marginTop: 6, fontFamily: 'inherit',
                                                                }}
                                                                placeholder="Expected answer (optional — for grading)"
                                                                value={q.expectedAnswer || ''}
                                                                onChange={e => setPreviewQuestions(prev => prev.map((v, j) => j === i ? { ...v, expectedAnswer: e.target.value } : v))}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                                <button className={styles.modalAddQuestion}
                                                    onClick={() => setPreviewQuestions(prev => [...prev, { question: '', expectedAnswer: '', target_skill: '', source: 'manual' }])}>
                                                    + Add Question
                                                </button>
                                                <button className={styles.modalAddQuestion}
                                                    onClick={generateQuestionsForPreview}
                                                    style={{ background: '#eef2ff', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                                                    🔄 Regenerate AI Questions
                                                </button>
                                            </div>

                                            <div className={styles.invitePreview} style={{ marginTop: 16 }}>
                                                <div className={styles.invitePreviewIcon}>📧</div>
                                                <div>
                                                    <strong>To:</strong> {inviteCandidate.email}<br />
                                                    <strong>Expiry:</strong> {inviteExpiryHours} hours<br />
                                                    <strong>Questions:</strong> {previewQuestions.length} ({previewQuestions.filter(q => q.source === 'ai').length} AI + {previewQuestions.filter(q => q.source === 'manual').length} manual)
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* STEP 4: Sending */}
                            {inviteStep === 4 && (
                                <div style={{ textAlign: 'center', padding: '40px 24px' }}>
                                    <div style={{ width: 48, height: 48, border: '4px solid #e8e8ef', borderTopColor: '#e8604c', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                                    <p style={{ fontSize: '1rem', color: '#1a1a2e', fontWeight: 600 }}>Sending invite...</p>
                                </div>
                            )}
                        </div>
                        <div className={styles.modalFooter}>
                            {inviteStep > 1 && inviteStep < 4 && (
                                <button className={styles.modalCancel} onClick={() => setInviteStep(inviteStep - 1)}>← Back</button>
                            )}
                            {inviteStep < 3 ? (
                                <button className={styles.modalSend} onClick={async () => {
                                    if (inviteStep === 2) {
                                        setInviteStep(3);
                                        await generateQuestionsForPreview();
                                    } else {
                                        setInviteStep(inviteStep + 1);
                                    }
                                }}>
                                    Next →
                                </button>
                            ) : inviteStep === 3 ? (
                                <button className={styles.modalSend}
                                    disabled={previewQuestions.length === 0 || isGeneratingQuestions || inviteSending}
                                    onClick={handleSendInvite}>
                                    🚀 Send Invite
                                </button>
                            ) : null}
                            {inviteStep === 1 && (
                                <button className={styles.modalCancel} onClick={() => setShowInviteModal(false)}>Cancel</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className={styles.toast}>{toast}</div>}
        </div>
    );
}
