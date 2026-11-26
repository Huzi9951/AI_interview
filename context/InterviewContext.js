'use client';

import { createContext, useContext, useReducer } from 'react';

const InterviewContext = createContext(null);

const initialState = {
    // Setup data
    jobDescription: '',
    resumeText: '',
    resumeFileName: '',
    skillAnalysis: null,
    includeCodingRound: false,

    // Interview state
    phase: 'setup', // setup | interview | coding | report
    questions: [],
    currentQuestionIndex: -1,
    answers: [],
    evaluations: [],

    // Proctoring
    violations: [],
    violationCount: 0,
    isTerminated: false,

    // Coding
    codingProblem: null,
    codingSubmission: null,
    codingEvaluation: null,

    // Report
    finalReport: null,

    // Status
    isProcessing: false,
    error: null,
};

function interviewReducer(state, action) {
    switch (action.type) {
        case 'SET_JOB_DESCRIPTION':
            return { ...state, jobDescription: action.payload };

        case 'SET_RESUME':
            return { ...state, resumeText: action.payload.text, resumeFileName: action.payload.fileName };

        case 'SET_SKILL_ANALYSIS':
            return { ...state, skillAnalysis: action.payload };

        case 'SET_CODING_ROUND':
            return { ...state, includeCodingRound: action.payload };

        case 'SET_PHASE':
            return { ...state, phase: action.payload };

        case 'ADD_QUESTION':
            return {
                ...state,
                questions: [...state.questions, action.payload],
                currentQuestionIndex: state.questions.length,
            };

        case 'ADD_ANSWER':
            return {
                ...state,
                answers: [...state.answers, action.payload],
            };

        case 'ADD_EVALUATION':
            return {
                ...state,
                evaluations: [...state.evaluations, action.payload],
            };

        case 'ADD_VIOLATION':
            return {
                ...state,
                violations: [...state.violations, action.payload],
                violationCount: state.violationCount + 1,
            };

        case 'TERMINATE':
            return { ...state, isTerminated: true };

        case 'SET_CODING_PROBLEM':
            return { ...state, codingProblem: action.payload };

        case 'SET_CODING_SUBMISSION':
            return { ...state, codingSubmission: action.payload };

        case 'SET_CODING_EVALUATION':
            return { ...state, codingEvaluation: action.payload };

        case 'SET_FINAL_REPORT':
            return { ...state, finalReport: action.payload };

        case 'SET_PROCESSING':
            return { ...state, isProcessing: action.payload };

        case 'SET_ERROR':
            return { ...state, error: action.payload };

        case 'RESET':
            return initialState;

        default:
            return state;
    }
}

export function InterviewProvider({ children }) {
    const [state, dispatch] = useReducer(interviewReducer, initialState);

    return (
        <InterviewContext.Provider value={{ state, dispatch }}>
            {children}
        </InterviewContext.Provider>
    );
}

export function useInterview() {
    const context = useContext(InterviewContext);
    if (!context) {
        throw new Error('useInterview must be used within an InterviewProvider');
    }
    return context;
}
