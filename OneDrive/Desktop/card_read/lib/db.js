import { supabase } from './supabaseClient';

// =============================================
// Interview CRUD
// =============================================

/** Create a new pending interview record */
export async function createInterview({ candidateEmail, candidateName, jobTitle, jobId, tokenHash, customQuestions }) {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('interviews')
        .insert({
            candidate_email: candidateEmail,
            candidate_name: candidateName || '',
            job_title: jobTitle || '',
            job_id: jobId || '',
            token_hash: tokenHash || null,
            custom_questions: customQuestions || [],
            status: 'pending',
        })
        .select()
        .single();
    if (error) { console.error('createInterview error:', error); return null; }
    return data;
}

/** Check if an interview already exists and is completed for this token */
export async function hasCompletedInterview(tokenHash) {
    if (!supabase || !tokenHash) return false;
    const { data, error } = await supabase
        .from('interviews')
        .select('id, status')
        .eq('token_hash', tokenHash)
        .in('status', ['in_progress', 'completed'])
        .limit(1);
    if (error) { console.error('hasCompletedInterview error:', error); return false; }
    return data && data.length > 0;
}

/** Get interview by token hash */
export async function getInterviewByToken(tokenHash) {
    if (!supabase || !tokenHash) return null;
    const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .eq('token_hash', tokenHash)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    if (error) { console.error('getInterviewByToken error:', error); return null; }
    return data;
}

/** Mark interview as in-progress */
export async function startInterviewRecord(interviewId) {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('interviews')
        .update({ status: 'in_progress', started_at: new Date().toISOString() })
        .eq('id', interviewId)
        .select()
        .single();
    if (error) console.error('startInterviewRecord error:', error);
    return data;
}

/** Save completed interview with all data */
export async function completeInterview(interviewId, {
    questions, violations, reportData, overallScore, hireRecommendation, recordingUrl, skillAnalysis
}) {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('interviews')
        .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            questions: questions || [],
            violations: violations || [],
            report_data: reportData || {},
            overall_score: overallScore || 0,
            hire_recommendation: hireRecommendation || '',
            recording_url: recordingUrl || null,
            skill_analysis: skillAnalysis || {},
        })
        .eq('id', interviewId)
        .select()
        .single();
    if (error) {
        console.error('completeInterview error:', error.message || JSON.stringify(error));
    }
    return data;
}

/** Delete an interview record */
export async function deleteInterview(id) {
    if (!supabase || !id) return false;
    const { error } = await supabase.from('interviews').delete().eq('id', id);
    if (error) { console.error('deleteInterview error:', error); return false; }
    return true;
}

/** Completely wipe all candidate data including videos based on email */
export async function deleteCandidateDataCompletely(email) {
    if (!email) return false;
    try {
        const res = await fetch('/api/delete-candidate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) {
            console.error('deleteCandidateDataCompletely error:', data.error);
            return false;
        }
        return data.success;
    } catch (err) {
        console.error('deleteCandidateDataCompletely error:', err);
        return false;
    }
}

/** Completely wipe all interview and recording data related to a job_id */
export async function deleteJobDataCompletely(jobId) {
    if (!jobId) return false;
    try {
        const res = await fetch('/api/delete-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId }),
        });
        const data = await res.json();
        if (!res.ok) {
            console.error('deleteJobDataCompletely error:', data.error);
            return false;
        }
        return data.success;
    } catch (err) {
        console.error('deleteJobDataCompletely error:', err);
        return false;
    }
}

// =============================================
// Recording Upload
// =============================================

/** Upload recording blob securely via API route (bypass RLS) */
export async function uploadRecording(interviewId, blob) {
    if (!blob) return null;
    console.log(`uploadRecording: blob size = ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
    if (blob.size === 0) {
        console.warn('uploadRecording: blob is empty, skipping upload.');
        return null;
    }

    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const formData = new FormData();
            formData.append('file', blob, 'recording.webm');
            formData.append('interviewId', interviewId);

            const res = await fetch('/api/upload-recording', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                lastError = new Error(data.error || 'Upload failed');
                console.warn(`uploadRecording attempt ${attempt} failed:`, lastError.message);
                if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
                continue;
            }

            console.log('uploadRecording success:', data.url);
            return data.url || null;

        } catch (err) {
            lastError = err;
            console.warn(`uploadRecording attempt ${attempt} exception:`, err.message);
            if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }

    console.error('uploadRecording: all retries failed:', lastError);
    return null;
}

// =============================================
// Query Helpers (Admin)
// =============================================

/** Get all interviews (admin listing) */
export async function getAllInterviews() {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) { console.error('getAllInterviews error:', error); return []; }
    return data || [];
}

/** Get interviews for a specific candidate email */
export async function getInterviewsByEmail(email) {
    if (!supabase || !email) return [];
    const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .eq('candidate_email', email)
        .order('created_at', { ascending: false });
    if (error) { console.error('getInterviewsByEmail error:', error); return []; }
    return data || [];
}

/** Get a single interview by ID */
export async function getInterviewById(id) {
    if (!supabase || !id) return null;
    const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .eq('id', id)
        .single();
    if (error) { console.error('getInterviewById error:', error); return null; }
    return data;
}

/** Get all completed interviews (for syncing dashboard status) */
export async function getCompletedInterviews() {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('interviews')
        .select('id, candidate_email, candidate_name, job_title, job_id, overall_score, status, started_at, completed_at, recording_url')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });
    if (error) { console.error('getCompletedInterviews error:', error); return []; }
    return data || [];
}

