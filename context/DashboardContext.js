'use client';

import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';

const DashboardContext = createContext(null);

const STORAGE_KEY = 'hypereval_dashboard';
const USER_STORAGE_KEY = 'hypereval_user';

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
                j.id === action.payload.id
                    ? { ...j, status: action.payload.newStatus }
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

        case 'UPDATE_JOB_QUESTIONS': {
            const { jobId, customQuestions } = action.payload;
            const candidates = state.candidates.map(c => {
                const updatedAssignments = (c.jobAssignments || []).map(a => {
                    // Only update questions if status is 'assigned'
                    if (a.jobId === jobId && a.status === 'assigned') {
                        return { ...a, customQuestions, updatedAt: new Date().toISOString() };
                    }
                    return a;
                });
                return { ...c, jobAssignments: updatedAssignments };
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
                const { getSupabase } = await import('@/lib/supabaseBrowser');
                const client = getSupabase();
                if (client) {
                    const { data: { user } } = await client.auth.getUser();
                    if (user) {
                        currentUser = {
                            ...currentUser,
                            email: user.email,
                            role: user.user_metadata?.role || 'ADMIN',
                            assigned_jobs: user.user_metadata?.assigned_jobs || [],
                            assigned_candidates: user.user_metadata?.assigned_candidates || {},
                            companyName: user.user_metadata?.company_name || currentUser.companyName,
                            name: user.user_metadata?.full_name || user.user_metadata?.name || currentUser.name
                        };
                        dispatch({ type: 'UPDATE_USER', payload: currentUser });
                    }
                }
            } catch (authErr) {
                console.warn('Auth check failed:', authErr);
            }

            // Sync from Supabase (DB-first, no sample data fallback)
            try {
                const { getAllCandidates, getAllJobs, fetchAllInterviewsFromDB } = await import('@/lib/db');
                const [dbCandidates, dbJobs, dbAllInterviews] = await Promise.all([
                    getAllCandidates(),
                    getAllJobs(),
                    fetchAllInterviewsFromDB()
                ]);

                let formattedJobs = dbJobs.map(j => ({
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
                    requirements: j.requirements || '',
                    responsibilities: j.responsibilities || '',
                    applicantCount: 0,
                    status: j.status,
                    createdAt: j.created_at
                }));

                let formattedCandidates = dbCandidates.map(c => {
                    const assignments = dbAllInterviews
                        .filter(i => i.candidate_email === c.email)
                        .map(i => ({
                            jobId: i.job_id,
                            jobTitle: i.job_title,
                            status: i.status,
                            score: i.overall_score,
                            matchScore: i.resume_match_score || null,
                            analysis: i.skill_analysis || null,
                            customQuestions: i.custom_questions || [],
                            hireRecommendation: i.hire_recommendation || '',
                            recordingUrl: i.recording_url || null,
                            completedAt: i.completed_at || null,
                            startedAt: i.started_at || null,
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
                        source: c.source || '',
                        addedAt: c.added_at,
                        jobAssignments: assignments
                    };
                });

                // ROLE-BASED FILTERING
                if (currentUser.role === 'CLIENT') {
                    const assignedIds = new Set(currentUser.assigned_jobs || []);
                    const assignedCandidatesMap = currentUser.assigned_candidates || {};

                    formattedJobs = formattedJobs.filter(j => assignedIds.has(j.id));
                    
                    formattedCandidates = formattedCandidates.filter(c => {
                        return c.jobAssignments && c.jobAssignments.some(a => {
                            if (!assignedIds.has(a.jobId)) return false;
                            
                            const specificCandidates = assignedCandidatesMap[a.jobId];
                            if (specificCandidates && Array.isArray(specificCandidates)) {
                                return specificCandidates.includes(c.email);
                            }
                            
                            // If no specific candidates array is defined for this job (legacy), allow all
                            return true; 
                        });
                    });
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
            } catch (err) {
                console.warn('Dashboard sync with Supabase failed, starting with empty state:', err);
                dispatch({ type: 'INIT', payload: { jobs: [], candidates: [], interviewCount: 0, user: currentUser } });
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
            } else {
                throw new Error(data.error || 'Failed to add job');
            }
        } catch (err) {
            console.error('Persistent addJob failed:', err);
            throw err;
        }
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
            } else {
                throw new Error(data.error || 'Failed to update job');
            }
        } catch (err) {
            console.error('Persistent updateJob failed:', err);
            throw err;
        }
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
            } else {
                throw new Error(data.error || 'Failed to delete job');
            }
        } catch (err) {
            console.error('Persistent deleteJob failed:', err);
            throw err;
        }
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
                // Map API (snake_case) response back to camelCase for local state
                const apiCandidates = (data.candidates || []).map(c => ({
                    id: c.id,
                    name: c.name || '',
                    email: c.email,
                    phone: c.phone || '',
                    designation: c.designation || '',
                    company: c.company || '',
                    resumeText: c.resume_text || '',
                    source: c.source || '',
                    addedAt: c.added_at || new Date().toISOString(),
                }));
                dispatch({ type: 'ADD_CANDIDATES', payload: apiCandidates.length > 0 ? apiCandidates : candidatesArray });
                return apiCandidates.length > 0 ? apiCandidates : candidatesArray;
            } else {
                throw new Error(data.error || 'Failed to add candidates');
            }
        } catch (err) {
            console.error('Persistent addCandidates failed:', err);
            throw err;
        }
    };

    const unassignFromJob = async (candidateId, jobId) => {
        try {
            const candidate = state.candidates.find(c => c.id === candidateId);
            if (candidate) {
                // Persistent unassign via regular supabase if possible, but skip if admin needed
                const { getSupabase } = await import('@/lib/supabaseBrowser');
                const persistentClient = getSupabase();
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
        const candidatesToAssign = state.candidates.filter(c => idSet.has(c.id));
        const job = state.jobs.find(j => j.id === jobId);

        try {
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
                
                matchCandidatesWithJob(candidatesToAssign, job);
                return true;
            } else {
                throw new Error(data.error || 'Failed to assign candidates');
            }
        } catch (err) {
            console.error('Persistent assignToJob failed:', err);
            throw err;
        }
    };

    const matchCandidatesWithJob = async (candidatesOrIdSet, jobOrJobId) => {
        // Accept either direct data or legacy (idSet, jobId) format
        let job, candidatesToMatch;
        if (jobOrJobId && typeof jobOrJobId === 'object' && jobOrJobId.id) {
            // New format: (candidatesArray, jobObject)
            job = jobOrJobId;
            candidatesToMatch = Array.isArray(candidatesOrIdSet) ? candidatesOrIdSet : [];
        } else {
            // Legacy format: (idSet, jobId) — read from current state
            job = state.jobs.find(j => j.id === jobOrJobId);
            if (!job) return;
            candidatesToMatch = state.candidates.filter(c => candidatesOrIdSet.has(c.id));
        }

        if (!job) return;
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
                } else {
                    console.error('Persistent updateMatchScore API rejected the patch:', data.error);
                }
            }
        } catch (err) {
            console.error('Persistent updateMatchScore failed:', err);
        }
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
                } else {
                    throw new Error(data.error || 'Failed to update candidate status');
                }
            }
        } catch (err) {
            console.error('Persistent updateCandidateJobStatus failed:', err);
            throw err;
        }
    };

    const updateJobQuestions = async (jobId, customQuestions) => {
        try {
            // Update local state first for immediate UI reflection
            dispatch({ type: 'UPDATE_JOB_QUESTIONS', payload: { jobId, customQuestions } });

            // Persist the changes solely to the 'assigned' candidates (those waiting to be invited)
            const res = await fetch('/api/interviews/update-job-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId, customQuestions })
            });

            const data = await res.json();
            if (!data.success) {
                console.error('Failed to persist job questions updates:', data.error);
            }
        } catch (err) {
            console.error('API call updateJobQuestions failed:', err);
        }
    };

    const updateUser = async (userData) => {
        dispatch({ type: 'UPDATE_USER', payload: userData });
        if (typeof window !== 'undefined') {
            const currentUser = state.user || {};
            const merged = { ...currentUser, ...userData };
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(merged));
            
            // Sync with Supabase Auth Metadata
            try {
                const { getSupabase } = await import('@/lib/supabaseBrowser');
                const client = getSupabase();
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
            } else {
                throw new Error(data.error || 'Failed to remove candidate');
            }
        } catch (err) {
            console.error('Persistent removeCandidate failed:', err);
            throw err;
        }
    };

    const toggleJobStatus = async (jobId) => {
        const job = state.jobs.find(j => j.id === jobId);
        if (!job) return;
        const newStatus = job.status === 'open' ? 'closed' : 'open';
        try {
            const res = await fetch('/api/jobs', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: jobId, status: newStatus })
            });
            const data = await res.json();
            if (data.success) {
                dispatch({ type: 'TOGGLE_JOB_STATUS', payload: { id: jobId, newStatus } });
                return true;
            } else {
                throw new Error(data.error || 'Failed to toggle job status');
            }
        } catch (err) {
            console.error('Persistent toggleJobStatus failed:', err);
            throw err;
        }
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
            } else {
                throw new Error(data.error || 'Failed to update candidate');
            }
        } catch (err) {
            console.error('Persistent updateCandidate failed:', err);
            throw err;
        }
    };
 
    return (
        <DashboardContext.Provider value={{
            state,
            dispatch,
            getStats,
            addJob,
            updateJob,
            deleteJob,
            toggleJobStatus,
            addCandidates,
            updateCandidate,
            removeCandidate,
            unassignFromJob,
            assignToJob,
            matchCandidatesWithJob,
            updateMatchScore,
            updateCandidateJobStatus,
            updateJobQuestions,
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
