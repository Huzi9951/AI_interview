import { supabase, adminSupabase } from './supabaseClient';

// =============================================
// Interview CRUD
// =============================================

/** Create a new pending interview record */
export async function createInterview({ candidateEmail, candidateName, jobTitle, jobId, tokenHash, customQuestions, resumeText, resumeMatchScore }) {
    if (!adminSupabase) return null;
    const { data, error } = await adminSupabase
        .from('interviews')
        .insert({
            candidate_email: candidateEmail,
            candidate_name: candidateName,
            job_title: jobTitle,
            job_id: jobId,
            token_hash: tokenHash,
            custom_questions: customQuestions || [],
            status: 'pending'
        })
        .select()
        .single();
    if (error) { console.error('createInterview error:', error); return null; }
    return data;
}

/** Create multiple "assigned" interviews at once */
export async function createInterviewsBatch(interviews) {
    if (!adminSupabase || !interviews || interviews.length === 0) return null;
    const { data, error } = await adminSupabase
        .from('interviews')
        .upsert(interviews.map(i => ({
            candidate_email: i.candidateEmail,
            candidate_name: i.candidateName,
            job_title: i.jobTitle,
            job_id: i.jobId,
            status: i.status || 'assigned'
        })), { onConflict: 'candidate_email,job_id' })
        .select();
    if (error) { console.error('createInterviewsBatch error:', error); return null; }
    return data;
}

/** Unassign a candidate from a job by deleting the interview record */
export async function unassignCandidateFromJob(email, jobId) {
    if (!adminSupabase) return false;
    const { error } = await adminSupabase
        .from('interviews')
        .delete()
        .eq('candidate_email', email)
        .eq('job_id', jobId);
    if (error) { console.error('unassignCandidateFromJob error:', error); return false; }
    return true;
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

/** Update interview status and optionally other fields */
export async function updateInterviewStatus(id, status, extra = {}) {
    if (!adminSupabase) return null;
    const updatePayload = { status, ...extra };
    if (status === 'in_progress' && !updatePayload.started_at) {
        updatePayload.started_at = new Date().toISOString();
    } else if (status === 'completed' && !updatePayload.completed_at) {
        updatePayload.completed_at = new Date().toISOString();
    }

    const { data, error } = await adminSupabase
        .from('interviews')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
    if (error) console.error('updateInterviewStatus error:', error);
    return data;
}

/** Update Resume Match Score and Analysis for an assignment */
export async function updateMatchScore(candidateId, jobId, score, analysis = {}) {
    if (!adminSupabase) return null;
    
    // First find candidate email
    const { data: candidate } = await adminSupabase
        .from('candidates')
        .select('email')
        .eq('id', candidateId)
        .single();
        
    if (!candidate) return null;

    const { data, error } = await adminSupabase
        .from('interviews')
        .update({ 
            resume_match_score: score,
            skill_analysis: analysis 
        })
        .eq('candidate_email', candidate.email)
        .eq('job_id', jobId)
        .select();
        
    if (error) console.error('updateMatchScore error:', error);
    return data;
}

/** Update interview status by email and jobId (convenience) */
export async function updateInterviewStatusByEmail(email, jobId, status, extra = {}) {
    if (!adminSupabase) return null;
    const updatePayload = { status, ...extra };
    
    const { data, error } = await adminSupabase
        .from('interviews')
        .update(updatePayload)
        .eq('candidate_email', email)
        .eq('job_id', jobId)
        .select();
        
    if (error) console.error('updateInterviewStatusByEmail error:', error);
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
    if (!adminSupabase) return false;
    try {
        // Delete related interviews first
        await adminSupabase.from('interviews').delete().eq('candidate_email', email);
        // Then delete the candidate record
        const { error: candidateError } = await adminSupabase.from('candidates').delete().eq('email', email);
        if (candidateError) {
            console.error('deleteCandidateDataCompletely error deleting candidate:', candidateError);
            return false;
        }

        // Call API route to delete associated files (e.g., recordings)
        const res = await fetch('/api/delete-candidate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) {
            console.error('deleteCandidateDataCompletely error from API:', data.error);
            return false;
        }
        return data.success;
    } catch (err) {
        console.error('deleteCandidateDataCompletely exception:', err);
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
// Query Helpers
// =============================================

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

/** Get all interviews (for syncing dashboard status) */
export async function fetchAllInterviewsFromDB() {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
            .from('interviews')
            .select('id, candidate_email, candidate_name, job_title, job_id, overall_score, status, started_at, completed_at, recording_url, created_at')
            .order('created_at', { ascending: false });
        if (error) { console.error('fetchAllInterviewsFromDB error:', error); return []; }
        return data || [];
    } catch (err) {
        console.error('fetchAllInterviewsFromDB exception:', err);
        return [];
    }
}

// =============================================
// Candidates CRUD (Production)
// =============================================

export async function createCandidate(candidate) {
    if (!adminSupabase) return null;
    const { data, error } = await adminSupabase
        .from('candidates')
        .insert({
            name: candidate.name || '',
            email: candidate.email,
            phone: candidate.phone || '',
            designation: candidate.designation || '',
            company: candidate.company || '',
            resume_text: candidate.resumeText || '',
            source: candidate.source || '',
        })
        .select()
        .single();
    if (error) { console.error('createCandidate error:', error); return null; }
    return data;
}

export async function createCandidatesBatch(candidates) {
    if (!adminSupabase || !candidates || candidates.length === 0) return null;
    const { data, error } = await adminSupabase
        .from('candidates')
        .upsert(candidates.map(c => ({
            name: c.name || '',
            email: c.email,
            phone: c.phone || '',
            designation: c.designation || '',
            company: c.company || '',
            resume_text: c.resumeText || '',
            source: c.source || '',
        })), { onConflict: 'email' })
        .select();
    if (error) { console.error('createCandidatesBatch error:', JSON.stringify(error, null, 2)); return null; }
    return data;
}

export async function getAllCandidates() {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase.from('candidates').select('*').order('added_at', { ascending: false });
        if (error) { console.error('getAllCandidates error:', error); return []; }
        return data || [];
    } catch (err) {
        console.error('getAllCandidates exception:', err);
        return [];
    }
}

export async function updateCandidate(id, updates) {
    if (!adminSupabase) return null;
    const { data, error } = await adminSupabase
        .from('candidates')
        .update({
            name: updates.name,
            email: updates.email,
            phone: updates.phone,
            designation: updates.designation,
            company: updates.company,
            resume_text: updates.resumeText,
            source: updates.source,
        })
        .eq('id', id)
        .select()
        .single();
    if (error) { console.error('updateCandidate error:', error); return null; }
    return data;
}

// =============================================
// Jobs CRUD (Production)
// =============================================

export async function createJob(job) {
    if (!adminSupabase) return null;
    const { data, error } = await adminSupabase
        .from('jobs')
        .insert({
            title: job.title,
            description: job.description || '',
            skills: job.skills || [],
            status: job.status || 'open',
            location_type: job.locationType || '',
            location: job.location || '',
            experience_level: job.experienceLevel || '',
            experience_range: job.experienceRange || '',
            employment_type: job.employmentType || '',
            department: job.department || '',
            must_have: job.mustHave || [],
            preferred: job.preferred || [],
            salary_min: job.salaryMin || null,
            salary_max: job.salaryMax || null,
            currency: job.currency || 'USD',
        })
        .select()
        .single();
    if (error) { console.error('createJob error:', error); return null; }
    return data;
}

export async function getAllJobs() {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
        if (error) { console.error('getAllJobs error:', error); return []; }
        return data || [];
    } catch (err) {
        console.error('getAllJobs exception:', err);
        return [];
    }
}

export async function updateJob(id, updates) {
    if (!supabase || !id) return null;
    const { data, error } = await supabase
        .from('jobs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) { console.error('updateJob error:', error); return null; }
    return data;
}

export async function deleteJob(id) {
    if (!supabase || !id) return false;
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) { console.error('deleteJob error:', error); return false; }
    return true;
}
