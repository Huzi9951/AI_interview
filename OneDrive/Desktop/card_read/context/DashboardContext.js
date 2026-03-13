'use client';

import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';

const DashboardContext = createContext(null);

const STORAGE_KEY = 'hypereval_dashboard';
const USER_STORAGE_KEY = 'hypereval_user';

const sampleJobs = [
    {
        id: '1',
        title: 'AWS Cloud & DevOps SRE Engineer',
        locationType: 'In Office',
        location: 'Dubai',
        experienceLevel: 'Senior',
        experienceRange: '8-16 years',
        employmentType: 'Full-Time',
        department: 'Engineering',
        status: 'open',
        createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
        applicantCount: 9,
        description: 'We are looking for a Senior AWS Cloud & DevOps SRE Engineer to join our team in Dubai. The ideal candidate will have expertise in AWS services, CI/CD pipelines, infrastructure as code, and site reliability engineering.',
        skills: ['AWS', 'DevOps', 'Kubernetes', 'Terraform', 'CI/CD', 'Docker'],
        mustHave: ['8+ years of experience in cloud infrastructure', 'Bachelor\'s degree in Computer Science or related field', 'Strong expertise in AWS services (EC2, S3, Lambda, RDS)'],
        preferred: ['Kubernetes certification', 'Experience with multi-cloud environments'],
        salaryMin: 120000,
        salaryMax: 180000,
        currency: 'USD',
        requirements: 'Bachelor\'s degree in Computer Science or related field. 8+ years of experience in cloud infrastructure and DevOps.',
        responsibilities: 'Design and maintain cloud infrastructure on AWS. Implement CI/CD pipelines. Ensure system reliability and scalability.',
    },
    {
        id: '2',
        title: 'Oracle Technical & Functional Specialist (HRMS EBS)',
        locationType: 'In Office',
        location: 'Bangalore',
        experienceLevel: 'Senior',
        experienceRange: '8-15 years',
        employmentType: 'Full-Time',
        department: 'IT',
        status: 'closed',
        createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
        applicantCount: 2,
        description: 'Oracle HRMS EBS specialist needed for implementation and support projects.',
        skills: ['Oracle EBS', 'HRMS', 'PL/SQL', 'Oracle Forms'],
        salaryMin: 100000,
        salaryMax: 150000,
        currency: 'USD',
        requirements: '8+ years experience with Oracle EBS HRMS modules.',
        responsibilities: 'Configure and customize Oracle HRMS modules. Provide technical support.',
    },
    {
        id: '3',
        title: 'Oracle Specialist (Procurement EBS)',
        locationType: 'In Office',
        location: 'Bangalore',
        experienceLevel: 'Mid-Level',
        experienceRange: '5-10 years',
        employmentType: 'Full-Time',
        department: 'IT',
        status: 'closed',
        createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
        applicantCount: 2,
        description: 'Oracle Procurement EBS specialist for supply chain management projects.',
        skills: ['Oracle EBS', 'Procurement', 'PL/SQL', 'Supply Chain'],
        salaryMin: 90000,
        salaryMax: 130000,
        currency: 'USD',
        requirements: '5+ years experience with Oracle EBS Procurement modules.',
        responsibilities: 'Manage and configure Oracle Procurement modules.',
    },
    {
        id: '4',
        title: 'Solution Consultant – IoT & AI',
        locationType: 'In Office',
        location: 'Bangalore',
        experienceLevel: 'Junior',
        experienceRange: '0-2 years',
        employmentType: 'Full-Time',
        department: 'Business Development',
        status: 'closed',
        createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
        applicantCount: 18,
        description: 'Looking for a Solution Consultant to work on IoT and AI projects.',
        skills: ['IoT', 'AI', 'Machine Learning', 'Python', 'Solutions Architecture'],
        salaryMin: 60000,
        salaryMax: 90000,
        currency: 'USD',
        requirements: '0-2 years of experience in IoT or AI domains.',
        responsibilities: 'Assist in designing IoT and AI solutions for clients.',
    },
    {
        id: '5',
        title: 'Talent Acquisition Specialist (IT Niche Hiring)',
        locationType: 'In Office',
        location: 'Bangalore, Karnataka, India',
        experienceLevel: 'Mid-Level',
        experienceRange: '3-6 years',
        employmentType: 'Full-Time',
        department: 'Human Resources',
        status: 'closed',
        createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
        applicantCount: 5,
        description: 'IT niche hiring specialist for technical recruitment.',
        skills: ['Technical Recruiting', 'IT Hiring', 'ATS', 'Sourcing'],
        salaryMin: 50000,
        salaryMax: 80000,
        currency: 'USD',
        requirements: '3-6 years of experience in IT recruitment.',
        responsibilities: 'Source and recruit IT professionals for niche roles.',
    },
];

function loadFromStorage() {
    if (typeof window === 'undefined') return null;
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
}

const getInitialState = () => {
    const stored = loadFromStorage();
    if (stored) return stored;
    return {
        jobs: sampleJobs,
        candidates: [],
        interviewCount: 20,
    };
};

const initialState = {
    jobs: [],
    candidates: [],
    user: {
        name: '',
        email: '',
        designation: '',
        companyName: '',
        phone: '',
        role: 'ADMIN',
        assigned_jobs: []
    },
    loading: true,
};


function dashboardReducer(state, action) {
    switch (action.type) {
        case 'INIT':
            return { ...action.payload };

        case 'SET_LOADING':
            return { ...state, loading: action.payload };

        case 'ADD_JOB': {
            const newJob = {
                ...action.payload,
                id: Date.now().toString(),
                createdAt: new Date().toISOString(),
                applicantCount: 0,
                status: 'open',
            };
            return { ...state, jobs: [newJob, ...state.jobs] };
        }

        case 'UPDATE_JOB': {
            const jobs = state.jobs.map(j =>
                j.id === action.payload.id ? { ...j, ...action.payload } : j
            );
            return { ...state, jobs };
        }

        case 'DELETE_JOB': {
            const jobIdToRemove = action.payload;

            // 1. Remove from jobs array
            const jobs = state.jobs.filter(j => j.id !== jobIdToRemove);

            // 2. Unassign from all candidates recursively
            const candidates = state.candidates.map(c => {
                if (!c.jobAssignments || c.jobAssignments.length === 0) return c;
                return {
                    ...c,
                    jobAssignments: c.jobAssignments.filter(a => a.jobId !== jobIdToRemove)
                };
            });

            return { ...state, jobs, candidates };
        }

        case 'TOGGLE_JOB_STATUS': {
            const jobs = state.jobs.map(j =>
                j.id === action.payload
                    ? { ...j, status: j.status === 'open' ? 'closed' : 'open' }
                    : j
            );
            return { ...state, jobs };
        }

        case 'ADD_CANDIDATES': {
            const incoming = action.payload || [];
            if (incoming.length === 0) return state;

            const incomingEmails = new Set(incoming.map(c => c.email));
            
            // Remove existing candidates whose emails match the incoming ones
            // (They will be re-added at the top)
            const remainingCandidates = state.candidates.filter(c => !incomingEmails.has(c.email));

            const newCandidates = incoming.map(c => {
                // Find if candidate already existed in local state to preserve some metadata if needed
                const existing = state.candidates.find(ec => ec.email === c.email);
                
                return {
                    ...c,
                    name: c.name || (existing?.name) || '',
                    phone: c.phone || (existing?.phone) || '',
                    designation: c.designation || (existing?.designation) || '',
                    company: c.company || (existing?.company) || '',
                    id: existing?.id || (Date.now().toString() + Math.random().toString(36).substr(2, 9)),
                    addedAt: existing?.addedAt || new Date().toISOString(),
                    invited: existing?.invited || false,
                    invitedFor: existing?.invitedFor || null,
                    interviewStatus: existing?.interviewStatus || 'pending',
                    resumeText: c.resumeText || (existing?.resumeText) || '',
                    jobAssignments: existing?.jobAssignments || []
                };
            });

            return { ...state, candidates: [...newCandidates, ...remainingCandidates] };
        }

        case 'INVITE_CANDIDATES': {
            const emailSet = new Set(action.payload.emails || action.payload);
            const jobId = action.payload.jobId || null;
            const jobTitle = action.payload.jobTitle || null;
            const customQuestions = action.payload.customQuestions || [];
            const candidates = state.candidates.map(c =>
                emailSet.has(c.email) ? {
                    ...c,
                    invited: true,
                    invitedAt: new Date().toISOString(),
                    invitedFor: jobTitle || c.invitedFor,
                    invitedForJobId: jobId || c.invitedForJobId,
                    customQuestions: customQuestions.length ? customQuestions : c.customQuestions,
                    interviewStatus: 'invited',
                } : c
            );
            return { ...state, candidates };
        }

        case 'ASSIGN_TO_JOB': {
            // Assign candidates to a job (strictly 1 job constraint: overwriting existing)
            const { candidateIds, jobId: aJobId, jobTitle: aJobTitle, matchScore } = action.payload;
            const idSet = new Set(candidateIds);
            const candidates = state.candidates.map(c => {
                if (!idSet.has(c.id)) return c;
                return {
                    ...c,
                    jobAssignments: [{
                        jobId: aJobId,
                        jobTitle: aJobTitle,
                        status: 'assigned',
                        assignedAt: new Date().toISOString(),
                        matchScore: matchScore || null,
                    }],
                };
            });
            return { ...state, candidates };
        }

        case 'UPDATE_CANDIDATE_MATCH_SCORE': {
            const { candidateId, jobId, matchScore, analysis } = action.payload;
            const candidates = state.candidates.map(c => {
                if (c.id !== candidateId) return c;
                const assignments = (c.jobAssignments || []).map(a =>
                    a.jobId === jobId ? { ...a, matchScore, analysis: analysis || a.analysis } : a
                );
                return { ...c, jobAssignments: assignments };
            });
            return { ...state, candidates };
        }

        case 'CHANGE_CANDIDATE_JOB': {
            const { candidateId, newJobId, newJobTitle } = action.payload;
            const candidates = state.candidates.map(c => {
                if (c.id !== candidateId) return c;
                return {
                    ...c,
                    jobAssignments: [{
                        jobId: newJobId,
                        jobTitle: newJobTitle,
                        status: 'assigned',
                        assignedAt: new Date().toISOString(),
                    }]
                };
            });
            return { ...state, candidates };
        }

        case 'UNASSIGN_FROM_JOB': {
            const { candidateId, jobId: uJobId } = action.payload;
            const candidates = state.candidates.map(c => {
                if (c.id !== candidateId) return c;
                return {
                    ...c,
                    jobAssignments: (c.jobAssignments || []).filter(a => a.jobId !== uJobId),
                };
            });
            return { ...state, candidates };
        }

        case 'UPDATE_CANDIDATE_JOB_STATUS': {
            // Update status of a candidate for a specific job (with optional score)
            const { candidateId: ucId, jobId: ucJobId, status: ucStatus, matchScore: ucScore } = action.payload;
            const candidates = state.candidates.map(c => {
                if (c.id !== ucId) return c;
                const assignments = (c.jobAssignments || []).map(a =>
                    a.jobId === ucJobId ? { 
                        ...a, 
                        status: ucStatus, 
                        ...(ucScore != null ? { matchScore: ucScore } : {}), 
                        updatedAt: new Date().toISOString() 
                    } : a
                );
                return { ...c, jobAssignments: assignments };
            });
            return { ...state, candidates };
        }

        case 'UPDATE_CANDIDATE': {
            const { id, updates } = action.payload;
            return {
                ...state,
                candidates: state.candidates.map(c => 
                    c.id === id ? { ...c, ...updates } : c
                )
            };
        }

        case 'REMOVE_CANDIDATE': {
            return { ...state, candidates: state.candidates.filter(c => c.id !== action.payload) };
        }

        case 'INCREMENT_INTERVIEW_COUNT': {
            return { ...state, interviewCount: state.interviewCount + 1 };
        }

        case 'UPDATE_USER':
            return {
                ...state,
                user: { ...state.user, ...action.payload }
            };
        default:
            return state;
    }
}

export function DashboardProvider({ children }) {
    const [state, dispatch] = useReducer(dashboardReducer, initialState);

    // Initial Load: Priority to localStorage, fallback to Supabase sync
    useEffect(() => {
        async function initDashboard() {
            dispatch({ type: 'SET_LOADING', payload: true });
            // 0. Fetch User Role & Assigned Jobs from Supabase
            let currentUser = state.user;
            try {
                const { supabase: client } = await import('@/lib/supabaseClient');
                if (client) {
                    const { data: { user } } = await client.auth.getUser();
                    if (user) {
                        currentUser = {
                            ...currentUser,
                            email: user.email,
                            role: user.user_metadata?.role || 'ADMIN',
                            assigned_jobs: user.user_metadata?.assigned_jobs || [],
                            companyName: user.user_metadata?.company_name || currentUser.companyName,
                            name: user.user_metadata?.full_name || user.user_metadata?.name || currentUser.name
                        };
                        dispatch({ type: 'UPDATE_USER', payload: currentUser });
                    }
                }
            } catch (authErr) {
                console.warn('Auth check failed:', authErr);
            }

            // 1. Try LocalStorage for dashboard data
            const localData = getInitialState();
            
            // 2. Try Supabase sync
            try {
                const { getAllCandidates, getAllJobs, fetchAllInterviewsFromDB } = await import('@/lib/db');
                const [dbCandidates, dbJobs, dbAllInterviews] = await Promise.all([
                    getAllCandidates(),
                    getAllJobs(),
                    fetchAllInterviewsFromDB()
                ]);

                if (dbCandidates.length > 0 || dbJobs.length > 0) {
                    let formattedJobs = dbJobs.length > 0 ? dbJobs.map(j => ({
                        id: j.id,
                        title: j.title,
                        description: j.description,
                        skills: j.skills || [],
                        locationType: j.location_type || '',
                        location: j.location || '',
                        experienceLevel: j.experience_level || '',
                        experienceRange: j.experience_range || '',
                        employmentType: j.employment_type || '',
                        department: j.department || '',
                        mustHave: j.must_have || [],
                        preferred: j.preferred || [],
                        salaryMin: j.salary_min || null,
                        salaryMax: j.salary_max || null,
                        currency: j.currency || 'USD',
                        applicantCount: 0,
                        status: j.status,
                        createdAt: j.created_at
                    })) : [];

                    let formattedCandidates = dbCandidates.map(c => {
                        const assignments = dbAllInterviews
                            .filter(i => i.candidate_email === c.email)
                            .map(i => ({
                                jobId: i.job_id,
                                jobTitle: i.job_title,
                                status: i.status,
                                score: i.overall_score,
                                matchScore: i.resume_match_score || null,
                                analysis: i.skill_analysis || null, // Map skill_analysis from DB
                                assignedAt: i.created_at
                            }));

                        return {
                            id: c.id,
                            name: c.name,
                            email: c.email,
                            phone: c.phone || '',
                            designation: c.designation || '',
                            company: c.company || '',
                            resumeText: c.resume_text || '',
                            addedAt: c.added_at,
                            jobAssignments: assignments
                        };
                    });

                    // ROLE-BASED FILTERING
                    if (currentUser.role === 'CLIENT') {
                        const assignedIds = new Set(currentUser.assigned_jobs || []);
                        formattedJobs = formattedJobs.filter(j => assignedIds.has(j.id));
                        formattedCandidates = formattedCandidates.filter(c => 
                            c.jobAssignments && c.jobAssignments.some(a => assignedIds.has(a.jobId))
                        );
                    }

                    dispatch({
                        type: 'INIT',
                        payload: {
                            jobs: formattedJobs,
                            candidates: formattedCandidates,
                            interviewCount: dbAllInterviews.filter(i => i.status === 'completed').length,
                            user: currentUser,
                        }
                    });
                    console.log(`Dashboard synced with Supabase (${currentUser.role} mode)`);
                } else {
                    // Fallback to sample/local
                    dispatch({ type: 'INIT', payload: { ...(localData || getInitialState()), user: currentUser } });
                }
            } catch (err) {
                console.warn('Dashboard sync with Supabase failed:', err);
                dispatch({ type: 'INIT', payload: { ...(localData || getInitialState()), user: currentUser } });
            } finally {
                dispatch({ type: 'SET_LOADING', payload: false });
            }
        }
        initDashboard();
    }, []); // Empty dependency array to run once on mount


    // Persist to localStorage as a cache/backup
    useEffect(() => {
        if (state.jobs.length > 0 || state.candidates.length > 0) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    jobs: state.jobs,
                    candidates: state.candidates,
                    interviewCount: state.interviewCount,
                    // Do not store user or loading state in main dashboard storage
                }));
            } catch { /* ignore */ }
        }
    }, [state.jobs, state.candidates, state.interviewCount]); // Only persist relevant parts

    // Cross-tab sync for main dashboard data
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === STORAGE_KEY && e.newValue) {
                try {
                    const newData = JSON.parse(e.newValue);
                    // Only update jobs, candidates, interviewCount, preserve user and loading
                    dispatch({ type: 'INIT', payload: {
                        jobs: newData.jobs,
                        candidates: newData.candidates,
                        interviewCount: newData.interviewCount,
                        user: state.user,
                        loading: state.loading,
                    }});
                } catch { /* ignore */ }
            } else if (e.key === USER_STORAGE_KEY && e.newValue) {
                try {
                    const newUser = JSON.parse(e.newValue);
                    dispatch({ type: 'UPDATE_USER', payload: newUser });
                } catch { /* ignore */ }
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [state.user, state.loading]); // Depend on user and loading to ensure they are preserved

    const getStats = useCallback(() => {
        const totalApplicants = state.candidates.length;
        const openJobs = state.jobs.filter(j => j.status === 'open').length;
        const totalCandidates = state.candidates.length;

        let interviewCount = 0;
        state.candidates.forEach(c => {
            if (c.jobAssignments && c.jobAssignments.length > 0) {
                const status = c.jobAssignments[0].status;
                if (['interviewed', 'completed', 'accepted', 'rejected'].includes(status)) {
                    interviewCount++;
                }
            }
        });

        return {
            totalApplicants,
            openJobs,
            totalCandidates,
            interviewCount,
        };
    }, [state.candidates, state.jobs]);

    // ── Persistent Actions (Sync with Supabase) ──

    const addJob = async (jobData) => {
        try {
            const res = await fetch('/api/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jobData)
            });
            const data = await res.json();
            if (data.success) {
                const formatted = {
                    ...jobData,
                    id: data.job.id,
                    createdAt: data.job.created_at,
                    applicantCount: 0,
                    status: 'open'
                };
                dispatch({ type: 'ADD_JOB', payload: formatted });
                return formatted;
            }
        } catch (err) {
            console.error('Persistent addJob failed:', err);
        }
        // Fallback for offline/local-only
        dispatch({ type: 'ADD_JOB', payload: jobData });
    };

    const updateJob = async (jobData) => {
        try {
            const res = await fetch('/api/jobs', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jobData)
            });
            const data = await res.json();
            if (data.success) {
                dispatch({ type: 'UPDATE_JOB', payload: jobData });
                return true;
            }
        } catch (err) {
            console.error('Persistent updateJob failed:', err);
        }
        dispatch({ type: 'UPDATE_JOB', payload: jobData });
        return false;
    };

    const deleteJob = async (jobId) => {
        try {
            const res = await fetch('/api/jobs', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: jobId })
            });
            const data = await res.json();
            if (data.success) {
                dispatch({ type: 'DELETE_JOB', payload: jobId });
                return true;
            }
        } catch (err) {
            console.error('Persistent deleteJob failed:', err);
        }
        dispatch({ type: 'DELETE_JOB', payload: jobId });
        return false;
    };

    const addCandidates = async (candidatesArray) => {
        try {
            const res = await fetch('/api/candidates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ candidates: candidatesArray })
            });
            const data = await res.json();
            if (data.success) {
                // Use the candidates returned from API (with real UUIDs)
                const apiCandidates = data.candidates || candidatesArray;
                dispatch({ type: 'ADD_CANDIDATES', payload: apiCandidates });
                return apiCandidates;
            }
        } catch (err) {
            console.error('Persistent addCandidates failed:', err);
        }
        // Fallback: use temporary IDs in reducer for offline/error cases
        dispatch({ type: 'ADD_CANDIDATES', payload: candidatesArray });
        return candidatesArray;
    };

    const unassignFromJob = async (candidateId, jobId) => {
        try {
            const candidate = state.candidates.find(c => c.id === candidateId);
            if (candidate) {
                // Persistent unassign via regular supabase if possible, but skip if admin needed
                const { supabase: persistentClient } = await import('@/lib/supabaseClient');
                if (persistentClient) {
                    await persistentClient
                        .from('interviews')
                        .delete()
                        .eq('candidate_email', candidate.email)
                        .eq('job_id', jobId);
                }
            }
        } catch (err) {
            console.error('Persistent unassign skipped (falling back to local):', err);
        }
        dispatch({ type: 'UNASSIGN_FROM_JOB', payload: { candidateId, jobId } });
    };

    const assignToJob = async (idSet, jobId, jobTitle) => {
        try {
            const candidatesToAssign = state.candidates.filter(c => idSet.has(c.id));

            // Create new "assigned" status records in Supabase via API
            const inviteData = candidatesToAssign.map(c => ({
                candidateEmail: c.email,
                candidateName: c.name,
                jobTitle: jobTitle,
                jobId: jobId,
                status: 'assigned',
                resumeText: c.resumeText
            }));

            const res = await fetch('/api/interviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ interviews: inviteData })
            });

            const data = await res.json();
            if (data.success) {
                dispatch({
                    type: 'ASSIGN_TO_JOB',
                    payload: { candidateIds: Array.from(idSet), jobId, jobTitle }
                });
                
                // Trigger auto-matching for these candidates
                matchCandidatesWithJob(idSet, jobId);
                
                return true;
            }
        } catch (err) {
            console.error('Persistent assignToJob failed:', err);
        }
        // Fallback
        dispatch({
            type: 'ASSIGN_TO_JOB',
            payload: { candidateIds: Array.from(idSet), jobId, jobTitle }
        });
    };

    const matchCandidatesWithJob = async (idSet, jobId) => {
        const job = state.jobs.find(j => j.id === jobId);
        if (!job) return;

        const candidatesToMatch = state.candidates.filter(c => idSet.has(c.id));
        const { analyzeJDAndResume } = await import('@/lib/groqService');

        for (const candidate of candidatesToMatch) {
            if (!candidate.resumeText) continue;
            try {
                const result = await analyzeJDAndResume(job.description || job.title, candidate.resumeText);
                const score = result.overall_match_score ?? result.match_score ?? result.matchScore;
                if (score !== undefined) {
                    await updateMatchScore(candidate.id, job.id, score, result);
                }
            } catch (err) {
                console.error(`Auto-match failed for ${candidate.email}:`, err);
            }
        }
    };

    const updateMatchScore = async (candidateId, jobId, score, analysis = null) => {
        try {
            const candidate = state.candidates.find(c => c.id === candidateId);
            if (candidate) {
                const res = await fetch('/api/interviews', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: candidate.email,
                        jobId,
                        updates: { resume_match_score: score, skill_analysis: analysis }
                    })
                });
                const data = await res.json();
                if (data.success) {
                    dispatch({ type: 'UPDATE_CANDIDATE_MATCH_SCORE', payload: { candidateId, jobId, matchScore: score, analysis } });
                }
            }
        } catch (err) {
            console.error('Persistent updateMatchScore failed:', err);
        }
        dispatch({ type: 'UPDATE_CANDIDATE_MATCH_SCORE', payload: { candidateId, jobId, matchScore: score, analysis } });
    };

    const updateCandidateJobStatus = async (candidateId, jobId, status, score = null) => {
        try {
            const candidate = state.candidates.find(c => c.id === candidateId);
            if (candidate) {
                const res = await fetch('/api/interviews', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: candidate.email,
                        jobId,
                        updates: { status, ...(score != null ? { overall_score: score } : {}) }
                    })
                });
                const data = await res.json();
                if (data.success) {
                    dispatch({
                        type: 'UPDATE_CANDIDATE_JOB_STATUS',
                        payload: { candidateId, jobId, status, score },
                    });
                }
            }
        } catch (err) {
            console.error('Persistent updateCandidateJobStatus failed:', err);
        }
        dispatch({
            type: 'UPDATE_CANDIDATE_JOB_STATUS',
            payload: { candidateId, jobId, status, score },
        });
    };

    const updateUser = async (userData) => {
        dispatch({ type: 'UPDATE_USER', payload: userData });
        if (typeof window !== 'undefined') {
            const currentUser = state.user || {};
            const merged = { ...currentUser, ...userData };
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(merged));
            
            // Sync with Supabase Auth Metadata
            try {
                const { supabase: client } = await import('@/lib/supabaseClient');
                if (client) {
                    await client.auth.updateUser({
                        data: {
                            full_name: merged.name,
                            company_name: merged.companyName,
                            designation: merged.designation,
                            phone: merged.phone
                        }
                    });
                }
            } catch (err) {
                console.error('Sync profile to Auth failed:', err);
            }
        }
    };

    const removeCandidate = async (candidate) => {
        try {
            const res = await fetch('/api/delete-candidate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: candidate.email })
            });
            const data = await res.json();
            if (data.success) {
                dispatch({ type: 'REMOVE_CANDIDATE', payload: candidate.id });
                return true;
            }
        } catch (err) {
            console.error('Persistent removeCandidate failed:', err);
        }
        return false;
    };

    const updateCandidate = async (id, updates) => {
        try {
            const res = await fetch('/api/candidates', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, updates })
            });
            const data = await res.json();
            if (data.success) {
                dispatch({ type: 'UPDATE_CANDIDATE', payload: { id, updates } });
                return true;
            }
        } catch (err) {
            console.error('Persistent updateCandidate failed:', err);
        }
        dispatch({ type: 'UPDATE_CANDIDATE', payload: { id, updates } });
        return false;
    };
 
    return (
        <DashboardContext.Provider value={{
            state,
            dispatch,
            getStats,
            addJob,
            updateJob,
            deleteJob,
            addCandidates,
            updateCandidate,
            removeCandidate,
            unassignFromJob,
            assignToJob,
            matchCandidatesWithJob,
            updateMatchScore,
            updateCandidateJobStatus,
            updateUser
        }}>
            {children}
        </DashboardContext.Provider>
    );
}

export function useDashboard() {
    const context = useContext(DashboardContext);
    if (!context) {
        throw new Error('useDashboard must be used within a DashboardProvider');
    }
    return context;
}
