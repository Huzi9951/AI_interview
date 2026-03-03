'use client';

import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';

const DashboardContext = createContext(null);

const STORAGE_KEY = 'visionhire_dashboard';

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
    interviewCount: 0,
};

function dashboardReducer(state, action) {
    switch (action.type) {
        case 'INIT':
            return { ...action.payload };

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
            return { ...state, jobs: state.jobs.filter(j => j.id !== action.payload) };
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
            const existing = new Set(state.candidates.map(c => c.email));
            const newCandidates = action.payload
                .filter(c => !existing.has(c.email))
                .map(c => ({
                    ...c,
                    name: c.name || '',
                    phone: c.phone || '',
                    designation: c.designation || '',
                    company: c.company || '',
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    addedAt: new Date().toISOString(),
                    invited: false,
                    invitedFor: null,
                    interviewStatus: 'pending',
                }));
            return { ...state, candidates: [...state.candidates, ...newCandidates] };
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
            // Assign candidates to a job (adds to jobAssignments array)
            const { candidateIds, jobId: aJobId, jobTitle: aJobTitle } = action.payload;
            const idSet = new Set(candidateIds);
            const candidates = state.candidates.map(c => {
                if (!idSet.has(c.id)) return c;
                const assignments = c.jobAssignments || [];
                // Don't duplicate
                if (assignments.some(a => a.jobId === aJobId)) return c;
                return {
                    ...c,
                    jobAssignments: [...assignments, {
                        jobId: aJobId,
                        jobTitle: aJobTitle,
                        status: 'assigned', // assigned → invited → interviewed → accepted/rejected
                        assignedAt: new Date().toISOString(),
                    }],
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
            const { candidateId: ucId, jobId: ucJobId, status: ucStatus, score: ucScore } = action.payload;
            const candidates = state.candidates.map(c => {
                if (c.id !== ucId) return c;
                const assignments = (c.jobAssignments || []).map(a =>
                    a.jobId === ucJobId ? { ...a, status: ucStatus, ...(ucScore != null ? { score: ucScore } : {}), updatedAt: new Date().toISOString() } : a
                );
                return { ...c, jobAssignments: assignments };
            });
            return { ...state, candidates };
        }

        case 'REMOVE_CANDIDATE': {
            return { ...state, candidates: state.candidates.filter(c => c.id !== action.payload) };
        }

        case 'INCREMENT_INTERVIEW_COUNT': {
            return { ...state, interviewCount: state.interviewCount + 1 };
        }

        default:
            return state;
    }
}

export function DashboardProvider({ children }) {
    const [state, dispatch] = useReducer(dashboardReducer, initialState);

    // Load from localStorage on mount
    useEffect(() => {
        const data = getInitialState();
        dispatch({ type: 'INIT', payload: data });
    }, []);

    // Persist to localStorage on change
    useEffect(() => {
        if (state.jobs.length > 0 || state.candidates.length > 0) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            } catch { /* ignore */ }
        }
    }, [state]);

    const getStats = useCallback(() => {
        const totalApplicants = state.jobs.reduce((sum, j) => sum + (j.applicantCount || 0), 0)
            + state.candidates.length;
        const openJobs = state.jobs.filter(j => j.status === 'open').length;
        const totalCandidates = state.candidates.length;
        return {
            totalApplicants,
            openJobs,
            totalCandidates,
            interviewCount: state.interviewCount,
        };
    }, [state]);

    return (
        <DashboardContext.Provider value={{ state, dispatch, getStats }}>
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
