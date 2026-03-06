'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDashboard } from '@/context/DashboardContext';
import styles from './create.module.css';

const STEPS = ['Job Details', 'Job Description', 'Screening Criteria', 'Screening Form', 'AI Interview'];

const defaultForm = {
    title: '',
    employmentType: 'Full-Time',
    locationType: 'In Office',
    location: '',
    department: '',
    experienceLevel: 'Mid-Level',
    experienceMin: 2,
    experienceMax: 5,
    salaryMin: '',
    salaryMax: '',
    currency: 'USD',
    description: '',
    requirements: '',
    responsibilities: '',
    skills: [],
    mustHave: [],
    preferred: [],
    enableAI: true,
    aiTarget: 'ai_stage', // everyone | ai_stage | min_score
    interviewChannel: 'video',
    automatedScreening: true,
    aiDrivenInterviews: true,
    questionCount: 6,
    includeCoding: false,
};

export default function CreateJobPage() {
    const router = useRouter();
    const { dispatch } = useDashboard();
    const fileInputRef = useRef(null);

    const [phase, setPhase] = useState('method'); // method | paste | upload | form | success
    const [currentStep, setCurrentStep] = useState(0);
    const [form, setForm] = useState(defaultForm);
    const [newSkill, setNewSkill] = useState('');
    const [newMustHave, setNewMustHave] = useState('');
    const [newPreferred, setNewPreferred] = useState('');
    const [uploadedFile, setUploadedFile] = useState(null);
    const [pasteText, setPasteText] = useState('');
    const [extracting, setExtracting] = useState(false);
    const [aiParsing, setAiParsing] = useState(false);
    const [promptText, setPromptText] = useState('');
    const [aiGenerating, setAiGenerating] = useState(false);

    const updateForm = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    // AI-powered auto-fill from JD text
    const autoFillFromJD = async (jdText) => {
        setAiParsing(true);
        try {
            const { parseJobDescription } = await import('@/lib/groqService');
            const parsed = await parseJobDescription(jdText);

            setForm(prev => ({
                ...prev,
                title: parsed.title || prev.title,
                employmentType: parsed.employmentType || prev.employmentType,
                locationType: parsed.locationType || prev.locationType,
                location: parsed.location || prev.location,
                department: parsed.department || prev.department,
                experienceLevel: parsed.experienceLevel || prev.experienceLevel,
                experienceMin: parsed.experienceMin ?? prev.experienceMin,
                experienceMax: parsed.experienceMax ?? prev.experienceMax,
                description: parsed.description || jdText,
                requirements: parsed.requirements || prev.requirements,
                responsibilities: parsed.responsibilities || prev.responsibilities,
                skills: parsed.skills?.length ? parsed.skills : prev.skills,
                mustHave: parsed.mustHave?.length ? parsed.mustHave : prev.mustHave,
                preferred: parsed.preferred?.length ? parsed.preferred : prev.preferred,
                salaryMin: parsed.salaryMin || prev.salaryMin,
                salaryMax: parsed.salaryMax || prev.salaryMax,
                currency: parsed.currency || prev.currency,
            }));
        } catch (err) {
            console.error('AI parsing error:', err);
            // Fallback: just set description
            updateForm('description', jdText);
        } finally {
            setAiParsing(false);
        }
    };

    // PDF text extraction + AI auto-fill
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadedFile(file);
        setExtracting(true);

        try {
            let text = '';
            if (file.type === 'application/pdf') {
                const { extractTextFromPDF } = await import('@/lib/resumeParser');
                text = await extractTextFromPDF(file);
            } else {
                text = await file.text();
            }

            setExtracting(false);
            setPhase('form');
            // Auto-fill in background
            await autoFillFromJD(text);
        } catch (err) {
            console.error('File parsing error:', err);
            alert('Failed to parse file. Please try copy-pasting the content instead.');
            setExtracting(false);
        }
    };

    const handlePasteSubmit = async () => {
        if (!pasteText.trim()) return;
        setPhase('form');
        await autoFillFromJD(pasteText.trim());
    };

    // AI-powered generation from Prompt
    const autoGenerateFromPrompt = async (prompt) => {
        setAiGenerating(true);
        try {
            const { generateJobDescription } = await import('@/lib/groqService');
            const generated = await generateJobDescription(prompt);

            setForm(prev => ({
                ...prev,
                title: generated.title || prev.title,
                employmentType: generated.employmentType || prev.employmentType,
                locationType: generated.locationType || prev.locationType,
                location: generated.location || prev.location,
                department: generated.department || prev.department,
                experienceLevel: generated.experienceLevel || prev.experienceLevel,
                experienceMin: generated.experienceMin ?? prev.experienceMin,
                experienceMax: generated.experienceMax ?? prev.experienceMax,
                description: generated.description || '',
                requirements: generated.requirements || prev.requirements,
                responsibilities: generated.responsibilities || prev.responsibilities,
                skills: generated.skills?.length ? generated.skills : prev.skills,
                mustHave: generated.mustHave?.length ? generated.mustHave : prev.mustHave,
                preferred: generated.preferred?.length ? generated.preferred : prev.preferred,
                salaryMin: generated.salaryMin || prev.salaryMin,
                salaryMax: generated.salaryMax || prev.salaryMax,
                currency: generated.currency || prev.currency,
            }));
        } catch (err) {
            console.error('AI generation error:', err);
            alert('Failed to generate Job Description. Please try again.');
        } finally {
            setAiGenerating(false);
        }
    };

    const handlePromptSubmit = async () => {
        if (!promptText.trim()) return;
        setPhase('form');
        await autoGenerateFromPrompt(promptText.trim());
    };

    const addSkill = () => {
        const s = newSkill.trim();
        if (!s || form.skills.includes(s)) return;
        updateForm('skills', [...form.skills, s]);
        setNewSkill('');
    };

    const removeSkill = (skill) => {
        updateForm('skills', form.skills.filter(s => s !== skill));
    };

    const addMustHave = () => {
        const item = newMustHave.trim();
        if (!item) return;
        updateForm('mustHave', [...form.mustHave, item]);
        setNewMustHave('');
    };

    const removeMustHave = (index) => {
        updateForm('mustHave', form.mustHave.filter((_, i) => i !== index));
    };

    const addPreferred = () => {
        const item = newPreferred.trim();
        if (!item) return;
        updateForm('preferred', [...form.preferred, item]);
        setNewPreferred('');
    };

    const removePreferred = (index) => {
        updateForm('preferred', form.preferred.filter((_, i) => i !== index));
    };

    const handleSubmit = () => {
        const experienceRange = `${form.experienceMin}-${form.experienceMax} years`;
        const jobData = {
            ...form,
            experienceRange,
            salaryMin: form.salaryMin ? Number(form.salaryMin) : null,
            salaryMax: form.salaryMax ? Number(form.salaryMax) : null,
        };
        dispatch({ type: 'ADD_JOB', payload: jobData });
        setPhase('success');
    };

    const canNext = () => {
        switch (currentStep) {
            case 0: return form.title.trim() && form.location.trim();
            case 1: return form.description.trim().length > 10;
            case 2: return true;
            case 3: return true;
            case 4: return true;
            default: return false;
        }
    };

    const nextStep = () => {
        if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1);
        else handleSubmit();
    };

    const prevStep = () => {
        if (currentStep > 0) setCurrentStep(currentStep - 1);
    };

    // ═══════════ AI Parsing Overlay ═══════════
    const AiParsingOverlay = () => (
        (aiParsing || aiGenerating) ? (
            <div className={styles.aiOverlay}>
                <div className={styles.aiOverlayContent}>
                    <div className={styles.aiSpinner} />
                    <div className={styles.aiOverlayTitle}>
                        {aiGenerating ? '🤖 AI is drafting your job listing...' : '🤖 AI is analyzing your job description...'}
                    </div>
                    <div className={styles.aiOverlayDesc}>Auto-filling all form fields. This may take a few seconds.</div>
                </div>
            </div>
        ) : null
    );

    // ═══════════ RENDER: Method Selection ═══════════
    if (phase === 'method') {
        return (
            <div className={styles.createPage}>
                <div className={styles.pageHeader}>
                    <h1 className={styles.pageTitle}>Create New Job</h1>
                    <p className={styles.pageSubtitle}>Choose how you want to create your job posting</p>
                </div>

                <div className={styles.methodGrid}>
                    <div className={styles.methodCard} onClick={() => setPhase('upload')}>
                        <div className={styles.methodIcon}>📄</div>
                        <div className={styles.methodInfo}>
                            <div className={styles.methodTitle}>Upload Job Description</div>
                            <div className={styles.methodDesc}>Upload a JD file (PDF, DOC, DOCX) to automatically fill the form</div>
                        </div>
                    </div>

                    <div className={styles.methodCard} onClick={() => setPhase('paste')}>
                        <div className={styles.methodIcon}>📝</div>
                        <div className={styles.methodInfo}>
                            <div className={styles.methodTitle}>Paste Job Description</div>
                            <div className={styles.methodDesc}>Paste your existing job description text to automatically fill the form</div>
                        </div>
                    </div>

                    <div className={styles.methodCard} onClick={() => setPhase('prompt')}>
                        <div className={styles.methodIcon}>✨</div>
                        <div className={styles.methodInfo}>
                            <div className={styles.methodTitle}>Generate with AI</div>
                            <div className={styles.methodDesc}>Type a short prompt and let AI create a professional job posting for you</div>
                        </div>
                    </div>

                    <div className={styles.methodCard} onClick={() => setPhase('form')}>
                        <div className={styles.methodIcon}>✍️</div>
                        <div className={styles.methodInfo}>
                            <div className={styles.methodTitle}>Fill Manually</div>
                            <div className={styles.methodDesc}>Create a job posting by filling out the form manually</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════ RENDER: Upload ═══════════
    if (phase === 'upload') {
        return (
            <div className={styles.createPage}>
                <button className={styles.backLink} onClick={() => setPhase('method')}>
                    ← Back to methods
                </button>
                <div className={styles.pageHeader}>
                    <h1 className={styles.pageTitle}>Upload Job Description</h1>
                    <p className={styles.pageSubtitle}>Upload a file to extract and auto-fill the job details</p>
                </div>

                <div className={styles.uploadArea}>
                    <div
                        className={`${styles.uploadZone} ${uploadedFile ? styles.uploadZoneActive : ''}`}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className={styles.uploadIcon}>
                            {extracting ? '⏳' : uploadedFile ? '✅' : '📁'}
                        </div>
                        <div className={styles.uploadLabel}>
                            {extracting
                                ? 'Extracting text...'
                                : uploadedFile
                                    ? 'File uploaded successfully!'
                                    : 'Click to upload or drag & drop'}
                        </div>
                        <div className={styles.uploadHint}>
                            PDF, DOC, DOCX, or TXT files
                        </div>
                        {uploadedFile && (
                            <div className={styles.uploadFileName}>📄 {uploadedFile.name}</div>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.doc,.docx,.txt"
                            className={styles.fileInput}
                            onChange={handleFileUpload}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════ RENDER: Paste ═══════════
    if (phase === 'paste') {
        return (
            <div className={styles.createPage}>
                <button className={styles.backLink} onClick={() => setPhase('method')}>
                    ← Back to methods
                </button>
                <div className={styles.pageHeader}>
                    <h1 className={styles.pageTitle}>Paste Job Description</h1>
                    <p className={styles.pageSubtitle}>Paste the job description text below — AI will auto-fill all fields</p>
                </div>

                <div className={styles.pasteModal}>
                    <textarea
                        className={styles.pasteTextarea}
                        placeholder="Paste the full job description here..."
                        value={pasteText}
                        onChange={e => setPasteText(e.target.value)}
                        autoFocus
                    />
                    <div className={styles.pasteActions}>
                        <button className={styles.prevBtn} onClick={() => setPhase('method')}>
                            Cancel
                        </button>
                        <button
                            className={styles.nextBtn}
                            onClick={handlePasteSubmit}
                            disabled={!pasteText.trim()}
                        >
                            🤖 Auto-Fill with AI →
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════ RENDER: Prompt ═══════════
    if (phase === 'prompt') {
        return (
            <div className={styles.createPage}>
                <button className={styles.backLink} onClick={() => setPhase('method')}>
                    ← Back to methods
                </button>
                <div className={styles.pageHeader}>
                    <h1 className={styles.pageTitle}>Generate with AI</h1>
                    <p className={styles.pageSubtitle}>Describe the role you&apos;re hiring for, and AI will write the entire description.</p>
                </div>

                <div className={styles.pasteModal}>
                    <textarea
                        className={styles.pasteTextarea}
                        placeholder="e.g., I'm looking for a Senior React developer in New York with 5 years of experience. They should know Next.js, TypeScript, and AWS. Offer is 120k to 150k..."
                        value={promptText}
                        onChange={e => setPromptText(e.target.value)}
                        autoFocus
                    />
                    <div className={styles.pasteActions}>
                        <button className={styles.prevBtn} onClick={() => setPhase('method')}>
                            Cancel
                        </button>
                        <button
                            className={styles.nextBtn}
                            onClick={handlePromptSubmit}
                            disabled={!promptText.trim()}
                        >
                            ✨ Generate Job Listing →
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════ RENDER: Success ═══════════
    if (phase === 'success') {
        return (
            <div className={styles.createPage}>
                <div className={styles.successBanner}>
                    <div className={styles.successIcon}>🎉</div>
                    <h2 className={styles.successTitle}>Job Created Successfully!</h2>
                    <p className={styles.successDesc}>
                        Your job posting &quot;{form.title}&quot; has been created and is now live.
                    </p>
                    <div className={styles.successActions}>
                        <Link href="/dashboard/jobs" className={styles.prevBtn}>
                            View All Jobs
                        </Link>
                        <button className={styles.nextBtn} onClick={() => {
                            setForm(defaultForm);
                            setCurrentStep(0);
                            setPhase('method');
                        }}>
                            + Create Another
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════ RENDER: Multi-Step Form ═══════════
    return (
        <div className={styles.createPage}>
            <AiParsingOverlay />

            <button className={styles.backLink} onClick={() => setPhase('method')}>
                ← Back to methods
            </button>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Create New Job</h1>
                <p className={styles.pageSubtitle}>Review and edit the job details before posting</p>
            </div>

            {/* Stepper */}
            <div className={styles.stepperContainer}>
                <div className={styles.stepper}>
                    {STEPS.map((label, i) => (
                        <div key={i} style={{ display: 'contents' }}>
                            <div className={styles.step}>
                                <div className={`${styles.stepCircle} ${i === currentStep ? styles.stepCircleActive : ''} ${i < currentStep ? styles.stepCircleDone : ''}`}>
                                    {i < currentStep ? '✓' : i + 1}
                                </div>
                                <span className={`${styles.stepLabel} ${i <= currentStep ? styles.stepLabelActive : ''}`}>
                                    {label}
                                </span>
                            </div>
                            {i < STEPS.length - 1 && (
                                <div className={`${styles.stepConnector} ${i < currentStep ? styles.stepConnectorDone : ''}`} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Step Content */}
            <div className={styles.formCard}>
                {/* Step 1: Job Details */}
                {currentStep === 0 && (
                    <>
                        {aiParsing && (
                            <div className={styles.autofillBanner}>
                                <span className={styles.autofillIcon}>✨</span>
                                Fields are being auto-filled by AI...
                            </div>
                        )}

                        <div className={styles.formGroup} style={{ marginBottom: 20 }}>
                            <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>Job Title</label>
                            <input
                                className={styles.formInput}
                                placeholder="e.g., IoT + AI Solutions Architect"
                                value={form.title}
                                onChange={e => updateForm('title', e.target.value)}
                            />
                        </div>

                        <div className={styles.formGrid}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Employment Type</label>
                                <select className={styles.formSelect} value={form.employmentType} onChange={e => updateForm('employmentType', e.target.value)}>
                                    <option>Full-Time</option>
                                    <option>Part-Time</option>
                                    <option>Contract</option>
                                    <option>Internship</option>
                                    <option>Freelance</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Location Type</label>
                                <select className={styles.formSelect} value={form.locationType} onChange={e => updateForm('locationType', e.target.value)}>
                                    <option>In Office</option>
                                    <option>Remote</option>
                                    <option>Hybrid</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>Location</label>
                                <input
                                    className={styles.formInput}
                                    placeholder="e.g., Mumbai, Maharashtra"
                                    value={form.location}
                                    onChange={e => updateForm('location', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className={styles.formGrid2}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Department (optional)</label>
                                <select className={styles.formSelect} value={form.department} onChange={e => updateForm('department', e.target.value)}>
                                    <option value="">Select Department</option>
                                    <option>Engineering</option>
                                    <option>Design</option>
                                    <option>Marketing</option>
                                    <option>Sales</option>
                                    <option>Human Resources</option>
                                    <option>Finance</option>
                                    <option>Operations</option>
                                    <option>Business Development</option>
                                    <option>IT</option>
                                    <option>Legal</option>
                                    <option>Other</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Experience Level</label>
                                <select className={styles.formSelect} value={form.experienceLevel} onChange={e => updateForm('experienceLevel', e.target.value)}>
                                    <option>Entry Level</option>
                                    <option>Junior</option>
                                    <option>Mid-Level</option>
                                    <option>Senior</option>
                                    <option>Lead</option>
                                    <option>Director</option>
                                    <option>Executive</option>
                                </select>
                            </div>
                        </div>

                        <div className={styles.formGroup} style={{ marginBottom: 20 }}>
                            <div className={styles.rangeHeader}>
                                <label className={styles.formLabel}>Work Experience (Years)</label>
                                <span className={styles.rangeValue}>{form.experienceMin} - {form.experienceMax} years</span>
                            </div>
                            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                <input
                                    type="range"
                                    className={styles.rangeSlider}
                                    min="0"
                                    max="20"
                                    value={form.experienceMin}
                                    onChange={e => {
                                        const val = Number(e.target.value);
                                        updateForm('experienceMin', Math.min(val, form.experienceMax));
                                    }}
                                />
                                <input
                                    type="range"
                                    className={styles.rangeSlider}
                                    min="0"
                                    max="30"
                                    value={form.experienceMax}
                                    onChange={e => {
                                        const val = Number(e.target.value);
                                        updateForm('experienceMax', Math.max(val, form.experienceMin));
                                    }}
                                />
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Compensation Range</label>
                            <div className={styles.salaryRow}>
                                <select className={styles.formSelect} value={form.currency} onChange={e => updateForm('currency', e.target.value)}>
                                    <option value="USD">$ USD</option>
                                    <option value="INR">₹ INR</option>
                                    <option value="EUR">€ EUR</option>
                                    <option value="GBP">£ GBP</option>
                                </select>
                                <input
                                    className={styles.formInput}
                                    placeholder="60,000"
                                    type="number"
                                    value={form.salaryMin}
                                    onChange={e => updateForm('salaryMin', e.target.value)}
                                />
                                <input
                                    className={styles.formInput}
                                    placeholder="90,000"
                                    type="number"
                                    value={form.salaryMax}
                                    onChange={e => updateForm('salaryMax', e.target.value)}
                                />
                            </div>
                            <div className={styles.salaryNote}>
                                This information will not be visible to candidates
                            </div>
                        </div>

                        {/* Skills */}
                        <div className={styles.formGroup} style={{ marginTop: 20 }}>
                            <label className={styles.formLabel}>Skills</label>
                            <div className={styles.skillsInput} onClick={() => document.getElementById('skill-input')?.focus()}>
                                {form.skills.map(skill => (
                                    <span key={skill} className={styles.skillInputTag}>
                                        {skill}
                                        <button className={styles.skillInputTagRemove} onClick={(e) => { e.stopPropagation(); removeSkill(skill); }}>×</button>
                                    </span>
                                ))}
                                <input
                                    id="skill-input"
                                    className={styles.skillTextInput}
                                    placeholder={form.skills.length === 0 ? "e.g., React, Node.js, Python..." : "Add more..."}
                                    value={newSkill}
                                    onChange={e => setNewSkill(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') { e.preventDefault(); addSkill(); }
                                        if (e.key === 'Backspace' && !newSkill && form.skills.length) {
                                            removeSkill(form.skills[form.skills.length - 1]);
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </>
                )}

                {/* Step 2: Job Description */}
                {currentStep === 1 && (
                    <>
                        <div className={styles.formGroup} style={{ marginBottom: 20 }}>
                            <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>Job Description</label>
                            <textarea
                                className={styles.formTextarea}
                                placeholder="Describe the role, key responsibilities, and what makes this position exciting..."
                                value={form.description}
                                onChange={e => updateForm('description', e.target.value)}
                                style={{ minHeight: 200 }}
                            />
                        </div>

                        <div className={styles.formGroup} style={{ marginBottom: 20 }}>
                            <label className={styles.formLabel}>Requirements</label>
                            <textarea
                                className={styles.formTextarea}
                                placeholder="List the qualifications, education, and experience requirements..."
                                value={form.requirements}
                                onChange={e => updateForm('requirements', e.target.value)}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Responsibilities</label>
                            <textarea
                                className={styles.formTextarea}
                                placeholder="List the key responsibilities and duties..."
                                value={form.responsibilities}
                                onChange={e => updateForm('responsibilities', e.target.value)}
                            />
                        </div>
                    </>
                )}

                {/* Step 3: Screening Criteria - Must-Have + Preferred */}
                {currentStep === 2 && (
                    <>
                        <p className={styles.criteriaHint}>
                            Must-have criteria will be used to screen candidates based on their resume with 70% weightage, while preferred criteria will have 30% weightage.
                        </p>

                        <div className={styles.criteriaGrid}>
                            {/* Must Have Column */}
                            <div className={styles.criteriaColumn}>
                                <div className={styles.criteriaHeader}>
                                    <h3 className={styles.criteriaTitle}>Must Have</h3>
                                    <span className={styles.criteriaCount}>{form.mustHave.length} items</span>
                                </div>

                                <div className={styles.criteriaList}>
                                    {form.mustHave.map((item, i) => (
                                        <div key={i} className={styles.criteriaItem}>
                                            <span className={styles.criteriaItemText}>{item}</span>
                                            <button className={styles.criteriaItemRemove} onClick={() => removeMustHave(i)}>×</button>
                                        </div>
                                    ))}
                                </div>

                                <div className={styles.criteriaAdd}>
                                    <input
                                        className={styles.criteriaInput}
                                        placeholder="+ Add must-have..."
                                        value={newMustHave}
                                        onChange={e => setNewMustHave(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addMustHave())}
                                    />
                                </div>
                            </div>

                            {/* Preferred Column */}
                            <div className={styles.criteriaColumn}>
                                <div className={styles.criteriaHeader}>
                                    <h3 className={styles.criteriaTitle}>Preferred</h3>
                                    <span className={styles.criteriaCount}>{form.preferred.length} items</span>
                                </div>

                                <div className={styles.criteriaList}>
                                    {form.preferred.map((item, i) => (
                                        <div key={i} className={styles.criteriaItem}>
                                            <span className={styles.criteriaItemText}>{item}</span>
                                            <button className={styles.criteriaItemRemove} onClick={() => removePreferred(i)}>×</button>
                                        </div>
                                    ))}
                                </div>

                                <div className={styles.criteriaAdd}>
                                    <input
                                        className={styles.criteriaInput}
                                        placeholder="+ Add preferred..."
                                        value={newPreferred}
                                        onChange={e => setNewPreferred(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPreferred())}
                                    />
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Step 4: Screening Form (placeholder - simple custom questions) */}
                {currentStep === 3 && (
                    <>
                        <p className={styles.criteriaHint}>
                            Set up screening questions that candidates will answer when applying. These help you quickly filter applicants.
                        </p>

                        <div className={styles.screeningInfo}>
                            <div className={styles.screeningInfoIcon}>ℹ️</div>
                            <span>You&apos;ll set up screening questions after creating the job. Questions can be customized per interview.</span>
                        </div>
                    </>
                )}

                {/* Step 5: AI Interview */}
                {currentStep === 4 && (
                    <>
                        <div className={styles.aiStepGrid}>
                            {/* Left: Who should take */}
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Who should take the AI Interview?</label>
                                <div className={styles.radioGroup}>
                                    <label className={styles.radioOption}>
                                        <input type="radio" name="aiTarget" value="everyone"
                                            checked={form.aiTarget === 'everyone'}
                                            onChange={() => updateForm('aiTarget', 'everyone')} />
                                        <span>Everyone</span>
                                    </label>
                                    <label className={styles.radioOption}>
                                        <input type="radio" name="aiTarget" value="ai_stage"
                                            checked={form.aiTarget === 'ai_stage'}
                                            onChange={() => updateForm('aiTarget', 'ai_stage')} />
                                        <span>On AI Interview Stage</span>
                                    </label>
                                    <label className={styles.radioOption}>
                                        <input type="radio" name="aiTarget" value="min_score"
                                            checked={form.aiTarget === 'min_score'}
                                            onChange={() => updateForm('aiTarget', 'min_score')} />
                                        <span>Minimum Screening Score</span>
                                    </label>
                                </div>
                            </div>

                            {/* Right: Interview Channel */}
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Interview Channel</label>
                                <select className={styles.formSelect} value={form.interviewChannel} onChange={e => updateForm('interviewChannel', e.target.value)}>
                                    <option value="video">📹 Video Interview</option>
                                    <option value="audio">🎙️ Audio Interview</option>
                                </select>
                                <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: 6 }}>
                                    Candidates will join a {form.interviewChannel === 'video' ? 'video' : 'audio'} interview session
                                </p>
                            </div>
                        </div>

                        <div style={{ marginTop: 24 }}>
                            {/* Automated Screening */}
                            <div className={styles.featureCard}>
                                <div className={styles.featureCardHeader}>
                                    <div>
                                        <div className={styles.featureCardTitle}>
                                            Automated Screening
                                            <span className={styles.featureBadgeGreen}>Saves 80% time</span>
                                        </div>
                                        <div className={styles.featureCardDesc}>
                                            Quickly assess key skills, salary expectations, and availability to filter candidates.
                                        </div>
                                    </div>
                                    <button
                                        className={`${styles.toggle} ${form.automatedScreening ? styles.toggleActive : ''}`}
                                        onClick={() => updateForm('automatedScreening', !form.automatedScreening)}
                                    />
                                </div>
                                {form.automatedScreening && (
                                    <div className={styles.featureCardInfo}>
                                        <span className={styles.featureCardInfoIcon}>ℹ️</span>
                                        You&apos;ll set up screening questions after creating the job
                                    </div>
                                )}
                            </div>

                            {/* AI-Driven Interviews */}
                            <div className={styles.featureCard}>
                                <div className={styles.featureCardHeader}>
                                    <div>
                                        <div className={styles.featureCardTitle}>
                                            AI-Driven Interviews
                                            <span className={styles.featureBadgeOrange}>Top candidates only</span>
                                        </div>
                                        <div className={styles.featureCardDesc}>
                                            Conduct AI-driven interviews to test technical skills, problem-solving, and cultural fit, scheduling 1:1s only with top candidates.
                                        </div>
                                    </div>
                                    <button
                                        className={`${styles.toggle} ${form.aiDrivenInterviews ? styles.toggleActive : ''}`}
                                        onClick={() => updateForm('aiDrivenInterviews', !form.aiDrivenInterviews)}
                                    />
                                </div>
                                {form.aiDrivenInterviews && (
                                    <>
                                        <div className={styles.featureCardInfo}>
                                            <span className={styles.featureCardInfoIcon}>ℹ️</span>
                                            You&apos;ll set up custom interview questions after creating the job
                                        </div>
                                        <div style={{ padding: '0 20px 20px', display: 'flex', gap: 24 }}>
                                            <div className={styles.formGroup}>
                                                <label className={styles.formLabel}>Coding Round</label>
                                                <button
                                                    className={`${styles.toggle} ${form.includeCoding ? styles.toggleActive : ''}`}
                                                    onClick={() => updateForm('includeCoding', !form.includeCoding)}
                                                    style={{ marginTop: 4 }}
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* Navigation */}
                <div className={styles.formNav}>
                    <button
                        className={styles.prevBtn}
                        onClick={prevStep}
                        style={{ visibility: currentStep === 0 ? 'hidden' : 'visible' }}
                    >
                        ← Previous
                    </button>
                    <button
                        className={`${styles.nextBtn} ${currentStep === STEPS.length - 1 ? styles.submitBtn : ''}`}
                        onClick={nextStep}
                        disabled={!canNext()}
                    >
                        {currentStep === STEPS.length - 1 ? '✓ Create Job' : 'Next →'}
                    </button>
                </div>
            </div>
        </div>
    );
}
