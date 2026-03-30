import { requireAuth } from '@/lib/auth';
import { adminSupabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const { response: authError } = await requireAuth({ roles: ['ADMIN', 'TEAM_MEMBER', 'CLIENT'] });
    if (authError) return authError;

    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');

        const { fetchAllInterviewsFromDB, getInterviewsByEmail } = await import('@/lib/db');

        let interviews;
        if (email) {
            interviews = await getInterviewsByEmail(email);
        } else {
            interviews = await fetchAllInterviewsFromDB();
        }

        return Response.json({ success: true, interviews });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    const { response: authError } = await requireAuth({ roles: ['ADMIN', 'TEAM_MEMBER'] });
    if (authError) return authError;

    try {
        const { interviews } = await request.json();
        const { createInterviewsBatch } = await import('@/lib/db');
        const data = await createInterviewsBatch(interviews);
        if (data) {
            return Response.json({ 
                success: true, 
                count: data.length,
                ids: data.map(i => i.id)
            });
        }
        return Response.json({ error: 'Failed to create interviews' }, { status: 500 });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    const { response: authError } = await requireAuth({ roles: ['ADMIN', 'TEAM_MEMBER'] });
    if (authError) return authError;

    try {
        const { email, jobId, updates } = await request.json();
        
        if (!adminSupabase) return Response.json({ error: 'Admin Supabase not configured' }, { status: 500 });

        // Whitelist allowed update fields
        const ALLOWED_FIELDS = ['status', 'overall_score', 'resume_match_score', 'skill_analysis', 'hire_recommendation'];
        const safeUpdates = {};
        for (const key of ALLOWED_FIELDS) {
            if (updates[key] !== undefined) safeUpdates[key] = updates[key];
        }

        if (Object.keys(safeUpdates).length === 0) {
            return Response.json({ error: 'No valid update fields provided' }, { status: 400 });
        }

        const { data, error } = await adminSupabase
            .from('interviews')
            .update(safeUpdates)
            .eq('candidate_email', email)
            .eq('job_id', jobId)
            .select();

        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ success: true, data });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
