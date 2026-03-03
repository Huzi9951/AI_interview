'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useDashboard } from '@/context/DashboardContext';
import styles from './candidates.module.css';

// Extract emails (and optionally names/phones) from text
function parseContacts(text) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const lines = text.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean);
    const contacts = [];
    const seen = new Set();

    for (const line of lines) {
        const emails = line.match(emailRegex);
        if (emails) {
            for (const email of emails) {
                if (seen.has(email)) continue;
                seen.add(email);
                const before = line.split(email)[0].replace(/[<(,;]/g, '').trim();
                const phoneMatch = line.match(/(\+?\d[\d\s-]{7,15}\d)/);
                contacts.push({ email, name: before || '', phone: phoneMatch ? phoneMatch[1].trim() : '' });
            }
        }
    }

    const globalEmails = text.match(emailRegex) || [];
    for (const email of globalEmails) {
        if (!seen.has(email)) {
            seen.add(email);
            contacts.push({ email, name: '', phone: '' });
        }
    }
    return contacts;
}

export default function CandidatesPage() {
    const { state, dispatch } = useDashboard();
    const fileInputRef = useRef(null);
    const [manualName, setManualName] = useState('');
    const [manualEmail, setManualEmail] = useState('');
    const [manualPhone, setManualPhone] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [toast, setToast] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    // Multi-step invite modal
    const [showInvite, setShowInvite] = useState(false);
    const [inviteStep, setInviteStep] = useState(1); // 1=job, 2=expiry, 3=questions, 4=preview, 5=sending
    const [inviteJobId, setInviteJobId] = useState('');
    const [inviteExpiryHours, setInviteExpiryHours] = useState(48);
    const [inviteQuestions, setInviteQuestions] = useState([{ question: '', expectedAnswer: '' }]);
    const [previewQuestions, setPreviewQuestions] = useState([]); // [{question, expectedAnswer, target_skill, source}]
    const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
    const [questionCount, setQuestionCount] = useState(4);
    const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0, done: false });

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            let text = '';
            if (file.type === 'application/pdf') {
                const { extractTextFromPDF } = await import('@/lib/resumeParser');
                text = await extractTextFromPDF(file);
            } else { text = await file.text(); }
            const contacts = parseContacts(text);
            if (contacts.length === 0) { alert('No email addresses found.'); return; }
            dispatch({ type: 'ADD_CANDIDATES', payload: contacts.map(c => ({ ...c, source: file.name })) });
            showToast(`✓ ${contacts.length} candidate(s) imported from ${file.name}`);
        } catch (err) { alert('Failed to parse file.'); }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleAddManual = () => {
        const email = manualEmail.trim();
        if (!email || !email.includes('@')) return;
        dispatch({ type: 'ADD_CANDIDATES', payload: [{ email, name: manualName.trim(), phone: manualPhone.trim(), source: 'Manual' }] });
        setManualEmail(''); setManualName(''); setManualPhone('');
        showToast(`✓ Added ${manualName.trim() || email}`);
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };

    const filteredCandidates = state.candidates.filter(c => {
        const matchesSearch = !searchQuery ||
            c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesSearch;
    });

    const handleSelectAll = () => {
        if (selectedIds.size === filteredCandidates.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredCandidates.map(c => c.id)));
    };

    // ── Open invite modal ──
    const openInviteModal = () => {
        if (selectedIds.size === 0) return;
        setInviteStep(1);
        setInviteJobId('');
        setInviteExpiryHours(48);
        setInviteQuestions([{ question: '', expectedAnswer: '' }]);
        setPreviewQuestions([]);
        setQuestionCount(4);
        setSendProgress({ sent: 0, total: 0, done: false });
        setShowInvite(true);
    };

    // ── Generate AI questions for preview ──
    const generateQuestionsForPreview = async () => {
        const job = state.jobs.find(j => j.id === inviteJobId);
        if (!job) return;
        setIsGeneratingQuestions(true);
        try {
            const { generateInterviewQuestions } = await import('@/lib/groqService');
            const result = await generateInterviewQuestions(job.description || job.title, questionCount);
            const aiQuestions = (result.questions || []).map(q => ({
                question: q.question,
                expectedAnswer: '',
                target_skill: q.target_skill || '',
                source: 'ai',
            }));
            // Combine with manually added questions
            const manualQs = inviteQuestions.filter(q => q.question.trim()).map(q => ({
                question: q.question,
                expectedAnswer: q.expectedAnswer || '',
                target_skill: '',
                source: 'manual',
            }));
            setPreviewQuestions([...manualQs, ...aiQuestions]);
        } catch (err) {
            console.error('Failed to generate questions:', err);
            showToast('⚠ Failed to generate AI questions. You can still add manually.');
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

    // ── Reorder questions ──
    const moveQuestion = (idx, direction) => {
        const newQ = [...previewQuestions];
        const swapIdx = idx + direction;
        if (swapIdx < 0 || swapIdx >= newQ.length) return;
        [newQ[idx], newQ[swapIdx]] = [newQ[swapIdx], newQ[idx]];
        setPreviewQuestions(newQ);
    };

    // ── Send invites ──
    const handleSendInvites = async () => {
        const job = state.jobs.find(j => j.id === inviteJobId);
        if (!job) return;

        const selectedCandidates = state.candidates.filter(c => selectedIds.has(c.id));
        setInviteStep(5);
        setSendProgress({ sent: 0, total: selectedCandidates.length, done: false });

        // First assign all selected candidates to this job
        dispatch({
            type: 'ASSIGN_TO_JOB',
            payload: { candidateIds: Array.from(selectedIds), jobId: job.id, jobTitle: job.title },
        });

        // Use preview questions (with expected answers) for the invite
        const questionsPayload = previewQuestions.map(q => ({
            question: q.question,
            expectedAnswer: q.expectedAnswer || '',
        }));

        try {
            const res = await fetch('/api/send-invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    candidates: selectedCandidates.map(c => ({ email: c.email, name: c.name })),
                    jobTitle: job.title,
                    jobId: job.id,
                    jobDescription: job.description || '',
                    expiryHours: inviteExpiryHours,
                    customQuestions: questionsPayload,
                    questionCount: previewQuestions.length,
                }),
            });

            const data = await res.json();

            if (data.success) {
                const successEmails = data.results.filter(r => r.success).map(r => r.email);
                const successCandidateIds = state.candidates.filter(c => successEmails.includes(c.email)).map(c => c.id);

                // Update status for successfully invited candidates
                for (const cId of successCandidateIds) {
                    dispatch({ type: 'UPDATE_CANDIDATE_JOB_STATUS', payload: { candidateId: cId, jobId: job.id, status: 'invited' } });
                }

                // Also update the old invite fields
                dispatch({
                    type: 'INVITE_CANDIDATES',
                    payload: { emails: successEmails, jobId: job.id, jobTitle: job.title, customQuestions: questionsPayload },
                });

                setSendProgress({ sent: successEmails.length, total: selectedCandidates.length, done: true });
                showToast(`✓ ${data.message}`);
            } else {
                setSendProgress(prev => ({ ...prev, done: true }));
                showToast(`⚠ ${data.error || 'Failed to send invites'}`);
            }
        } catch (err) {
            setSendProgress(prev => ({ ...prev, done: true }));
            showToast(`⚠ Error: ${err.message}`);
        }
    };

    const closeInviteModal = () => {
        setShowInvite(false);
        if (sendProgress.done) setSelectedIds(new Set());
    };

    const openJobs = state.jobs.filter(j => j.status === 'open');

    // Get best status for display
    const getCandidateDisplayStatus = (c) => {
        const assignments = c.jobAssignments || [];
        if (assignments.length === 0) return null;
        // Find the most recent/relevant status
        const completed = assignments.find(a => a.status === 'completed');
        if (completed) return { status: 'completed', score: completed.score };
        const invited = assignments.find(a => a.status === 'invited');
        if (invited) return { status: 'invited' };
        return { status: assignments[0].status };
    };

    return (
        <div className={styles.candidatesPage}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.headerTitle}>Applicants</h1>
                    <span className={styles.headerCount}>{state.candidates.length} total candidates</span>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.inviteBtn} disabled={selectedIds.size === 0} onClick={openInviteModal}>
                        🚀 Invite ({selectedIds.size})
                    </button>
                    <button className={styles.uploadBtn} onClick={() => fileInputRef.current?.click()}>📤 Upload Applicants</button>
                    <input ref={fileInputRef} type="file" accept=".csv,.txt,.pdf,.xlsx,.xls,.doc,.docx" className={styles.fileInput} onChange={handleFileUpload} />
                </div>
            </div>

            {/* Toolbar */}
            <div className={styles.toolbar}>
                <div className={styles.searchBar}>
                    <span className={styles.searchIcon}>🔍</span>
                    <input className={styles.searchInput} placeholder="Search applicants..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
            </div>

            {/* Manual Add Row */}
            <div className={styles.addRow}>
                <input className={styles.addInput} placeholder="Name" value={manualName} onChange={e => setManualName(e.target.value)} style={{ maxWidth: 160 }} />
                <input className={styles.addInput} placeholder="Email *" value={manualEmail} onChange={e => setManualEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddManual()} style={{ flex: 1 }} />
                <input className={styles.addInput} placeholder="Phone" value={manualPhone} onChange={e => setManualPhone(e.target.value)} style={{ maxWidth: 140 }} />
                <button className={styles.addBtn} onClick={handleAddManual} disabled={!manualEmail.trim() || !manualEmail.includes('@')}>+ Add</button>
            </div>

            {/* Table */}
            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th className={styles.thCheck}>
                                <input type="checkbox" className={styles.checkbox}
                                    checked={selectedIds.size === filteredCandidates.length && filteredCandidates.length > 0}
                                    onChange={handleSelectAll} />
                            </th>
                            <th>Applicant</th>
                            <th>Contact Info</th>
                            <th>Assigned Jobs</th>
                            <th>Source</th>
                            <th>Date Added</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCandidates.length === 0 ? (
                            <tr>
                                <td colSpan={7} className={styles.emptyRow}>
                                    <div className={styles.emptyIcon}>👥</div>
                                    <div>No candidates found. Upload a file or add manually above.</div>
                                </td>
                            </tr>
                        ) : (
                            filteredCandidates.map(c => {
                                const displayStatus = getCandidateDisplayStatus(c);
                                return (
                                    <tr key={c.id} className={styles.tableRow}>
                                        <td className={styles.tdCheck}>
                                            <input type="checkbox" className={styles.checkbox} checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} />
                                        </td>
                                        <td>
                                            <div className={styles.applicantCell}>
                                                <span className={styles.applicantName}>{c.name || '—'}</span>
                                                {c.designation && <span className={styles.applicantRole}>{c.designation}</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <div className={styles.contactCell}>
                                                {c.phone && <span className={styles.contactPhone}>{c.phone}</span>}
                                                <span className={styles.contactEmail}>{c.email}</span>
                                            </div>
                                        </td>
                                        <td className={styles.tdJob}>
                                            {(c.jobAssignments || []).length > 0
                                                ? c.jobAssignments.map(a => (
                                                    <span key={a.jobId} className={styles.jobChip}>
                                                        {a.jobTitle}
                                                        <span className={styles.chipStatus}>
                                                            ({a.status}{a.status === 'completed' && a.score != null ? ` • ${a.score}/100` : ''})
                                                        </span>
                                                    </span>
                                                ))
                                                : '—'}
                                        </td>
                                        <td className={styles.tdSource}>{c.source || '—'}</td>
                                        <td className={styles.tdDate}>{new Date(c.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</td>
                                        <td className={styles.tdActions}>
                                            <Link href={`/dashboard/candidates/report?email=${encodeURIComponent(c.email)}`}
                                                className={styles.analyticsBtn} title="View Interview Analytics">
                                                📊 Analytics
                                            </Link>
                                            <button className={styles.removeBtn} onClick={() => dispatch({ type: 'REMOVE_CANDIDATE', payload: c.id })} title="Remove">✕</button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
                {filteredCandidates.length > 0 && (
                    <div className={styles.tableFooter}>Showing {filteredCandidates.length} of {state.candidates.length} results</div>
                )}
            </div>

            {/* ═══════════ Multi-Step Invite Modal ═══════════ */}
            {showInvite && (
                <div className={styles.modalOverlay} onClick={closeInviteModal}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2 className={styles.modalTitle}>
                                    {inviteStep === 1 && 'Select Job'}
                                    {inviteStep === 2 && 'Set Invite Expiry'}
                                    {inviteStep === 3 && 'Add Custom Questions'}
                                    {inviteStep === 4 && 'Review & Edit Questions'}
                                    {inviteStep === 5 && 'Sending Invites...'}
                                </h2>
                                <p className={styles.modalSubtitle}>
                                    {inviteStep < 5 ? `${selectedIds.size} candidate(s) selected • Step ${inviteStep} of 4` : `${sendProgress.sent}/${sendProgress.total} sent`}
                                </p>
                            </div>
                            <button className={styles.modalClose} onClick={closeInviteModal}>×</button>
                        </div>

                        <div className={styles.modalBody}>
                            {/* STEP 1: Select Job */}
                            {inviteStep === 1 && (
                                <div className={styles.stepContent}>
                                    <p className={styles.stepDesc}>Choose which job to invite candidates for:</p>
                                    {openJobs.length === 0 ? (
                                        <div className={styles.modalEmpty}>No open jobs. Create a job first.</div>
                                    ) : (
                                        <div className={styles.jobSelectList}>
                                            {openJobs.map(j => (
                                                <label key={j.id} className={`${styles.jobSelectItem} ${inviteJobId === j.id ? styles.jobSelectActive : ''}`}>
                                                    <input type="radio" name="inviteJob" value={j.id}
                                                        checked={inviteJobId === j.id}
                                                        onChange={() => setInviteJobId(j.id)} />
                                                    <div>
                                                        <strong>{j.title}</strong>
                                                        <span className={styles.jobSelectMeta}>{j.locationType} • {j.location}</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* STEP 2: Expiry */}
                            {inviteStep === 2 && (
                                <div className={styles.stepContent}>
                                    <p className={styles.stepDesc}>How long should this invite remain valid?</p>
                                    <div className={styles.expirySection}>
                                        <input type="number" className={styles.expiryInput} value={inviteExpiryHours} min={1} max={720}
                                            onChange={e => setInviteExpiryHours(Number(e.target.value))} />
                                        <span className={styles.expiryUnit}>hours</span>
                                    </div>
                                    <div className={styles.expiryPresets}>
                                        {[{ h: 24, l: '24 hours' }, { h: 48, l: '2 days' }, { h: 72, l: '3 days' }, { h: 168, l: '1 week' }].map(p => (
                                            <button key={p.h}
                                                className={`${styles.expiryPreset} ${inviteExpiryHours === p.h ? styles.expiryPresetActive : ''}`}
                                                onClick={() => setInviteExpiryHours(p.h)}>{p.l}</button>
                                        ))}
                                    </div>

                                    <div style={{ marginTop: 24 }}>
                                        <label style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>Number of AI Questions</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                                            <input type="number" className={styles.expiryInput} value={questionCount} min={1} max={15}
                                                onChange={e => setQuestionCount(Number(e.target.value))} style={{ width: 80 }} />
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>questions will be generated from JD</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: Custom Questions (with expected answers) */}
                            {inviteStep === 3 && (
                                <div className={styles.stepContent}>
                                    <p className={styles.stepDesc}>Add optional custom questions with expected answers (for grading):</p>
                                    {inviteQuestions.map((q, i) => (
                                        <div key={i} style={{ marginBottom: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px' }}>
                                            <div className={styles.questionRow}>
                                                <input className={styles.questionInput} placeholder={`Question ${i + 1}...`}
                                                    value={q.question} onChange={e => setInviteQuestions(prev => prev.map((v, j) => j === i ? { ...v, question: e.target.value } : v))} />
                                                {inviteQuestions.length > 1 && (
                                                    <button className={styles.questionRemove}
                                                        onClick={() => setInviteQuestions(prev => prev.filter((_, j) => j !== i))}>×</button>
                                                )}
                                            </div>
                                            <input className={styles.questionInput}
                                                placeholder="Expected answer (optional — used for grading)"
                                                style={{ marginTop: 6, fontSize: '0.82rem', opacity: 0.8 }}
                                                value={q.expectedAnswer}
                                                onChange={e => setInviteQuestions(prev => prev.map((v, j) => j === i ? { ...v, expectedAnswer: e.target.value } : v))} />
                                        </div>
                                    ))}
                                    <button className={styles.addQuestionBtn} onClick={() => setInviteQuestions(prev => [...prev, { question: '', expectedAnswer: '' }])}>+ Add Question</button>
                                </div>
                            )}

                            {/* STEP 4: Question Preview & Edit */}
                            {inviteStep === 4 && (
                                <div className={styles.stepContent}>
                                    {isGeneratingQuestions ? (
                                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                            <div className={styles.sendingSpinner} />
                                            <p style={{ color: 'var(--text-secondary)', marginTop: 16 }}>Generating AI questions from job description...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <p className={styles.stepDesc}>Review, edit, and reorder the interview questions below. These are the questions the AI will ask during the interview:</p>
                                            {previewQuestions.length === 0 ? (
                                                <div className={styles.modalEmpty}>No questions generated. Go back to add custom questions or adjust settings.</div>
                                            ) : (
                                                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                                                    {previewQuestions.map((q, i) => (
                                                        <div key={i} style={{
                                                            background: 'rgba(255,255,255,0.03)',
                                                            border: '1px solid var(--border-subtle)',
                                                            borderRadius: 10,
                                                            padding: '12px 14px',
                                                            marginBottom: 10,
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, minWidth: 20 }}>{i + 1}.</span>
                                                                <span style={{
                                                                    background: q.source === 'ai' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(232, 96, 76, 0.15)',
                                                                    color: q.source === 'ai' ? '#818cf8' : '#e8604c',
                                                                    fontSize: '0.7rem',
                                                                    padding: '2px 8px',
                                                                    borderRadius: 6,
                                                                    fontWeight: 600,
                                                                }}>
                                                                    {q.source === 'ai' ? '🤖 AI' : '✏️ Manual'}
                                                                </span>
                                                                {q.target_skill && (
                                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>• {q.target_skill}</span>
                                                                )}
                                                                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                                                                    <button onClick={() => moveQuestion(i, -1)} disabled={i === 0}
                                                                        style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 6, width: 28, height: 28, cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1, fontSize: '0.8rem' }}>↑</button>
                                                                    <button onClick={() => moveQuestion(i, 1)} disabled={i === previewQuestions.length - 1}
                                                                        style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 6, width: 28, height: 28, cursor: i === previewQuestions.length - 1 ? 'default' : 'pointer', opacity: i === previewQuestions.length - 1 ? 0.3 : 1, fontSize: '0.8rem' }}>↓</button>
                                                                    <button onClick={() => setPreviewQuestions(prev => prev.filter((_, j) => j !== i))}
                                                                        style={{ background: 'none', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: '0.8rem' }}>×</button>
                                                                </div>
                                                            </div>
                                                            <textarea
                                                                style={{
                                                                    width: '100%', background: 'transparent', border: '1px solid var(--border-subtle)',
                                                                    borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px',
                                                                    fontSize: '0.88rem', resize: 'vertical', minHeight: 42, fontFamily: 'inherit',
                                                                }}
                                                                value={q.question}
                                                                onChange={e => setPreviewQuestions(prev => prev.map((v, j) => j === i ? { ...v, question: e.target.value } : v))}
                                                            />
                                                            <input
                                                                style={{
                                                                    width: '100%', background: 'transparent', border: '1px solid var(--border-subtle)',
                                                                    borderRadius: 8, color: 'var(--text-secondary)', padding: '6px 10px',
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
                                                <button className={styles.addQuestionBtn}
                                                    onClick={() => setPreviewQuestions(prev => [...prev, { question: '', expectedAnswer: '', target_skill: '', source: 'manual' }])}>
                                                    + Add Question
                                                </button>
                                                <button className={styles.addQuestionBtn}
                                                    onClick={generateQuestionsForPreview}
                                                    style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                                                    🔄 Regenerate AI Questions
                                                </button>
                                            </div>

                                            <div className={styles.inviteSummary}>
                                                <strong>Summary:</strong><br />
                                                Job: {state.jobs.find(j => j.id === inviteJobId)?.title}<br />
                                                Expiry: {inviteExpiryHours} hours<br />
                                                Candidates: {selectedIds.size}<br />
                                                Questions: {previewQuestions.length} ({previewQuestions.filter(q => q.source === 'ai').length} AI + {previewQuestions.filter(q => q.source === 'manual').length} manual)<br />
                                                Via: Outlook SMTP
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* STEP 5: Sending Progress */}
                            {inviteStep === 5 && (
                                <div className={styles.stepContent} style={{ textAlign: 'center', padding: '40px 24px' }}>
                                    {!sendProgress.done ? (
                                        <>
                                            <div className={styles.sendingSpinner} />
                                            <p className={styles.sendingText}>Sending invite emails...</p>
                                            <p className={styles.sendingProgress}>{sendProgress.sent} / {sendProgress.total}</p>
                                        </>
                                    ) : (
                                        <>
                                            <div className={styles.sendingDone}>✓</div>
                                            <p className={styles.sendingText}>
                                                {sendProgress.sent === sendProgress.total
                                                    ? `All ${sendProgress.total} invite(s) sent successfully!`
                                                    : `${sendProgress.sent}/${sendProgress.total} sent successfully.`}
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className={styles.modalFooter}>
                            {inviteStep < 5 && (
                                <>
                                    {inviteStep > 1 && (
                                        <button className={styles.modalCancel} onClick={() => setInviteStep(inviteStep - 1)}>← Back</button>
                                    )}
                                    {inviteStep < 4 ? (
                                        <button className={styles.modalSend}
                                            disabled={(inviteStep === 1 && !inviteJobId) || (inviteStep === 3 && isGeneratingQuestions)}
                                            onClick={async () => {
                                                if (inviteStep === 3) {
                                                    // Moving to preview: generate questions
                                                    setInviteStep(4);
                                                    await generateQuestionsForPreview();
                                                } else {
                                                    setInviteStep(inviteStep + 1);
                                                }
                                            }}>
                                            Next →
                                        </button>
                                    ) : (
                                        <button className={styles.modalSend}
                                            disabled={previewQuestions.length === 0 || isGeneratingQuestions}
                                            onClick={handleSendInvites}>
                                            🚀 Send {selectedIds.size} Invite(s)
                                        </button>
                                    )}
                                </>
                            )}
                            {inviteStep === 5 && sendProgress.done && (
                                <button className={styles.modalSend} onClick={closeInviteModal}>Done</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className={styles.toast}>{toast}</div>}
        </div>
    );
}
