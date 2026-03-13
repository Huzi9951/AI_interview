import { adminSupabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET(request) {
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
    try {
        const { interviews } = await request.json();
        const { createInterviewsBatch } = await import('@/lib/db');
        const data = await createInterviewsBatch(interviews);
        if (data) {
            return Response.json({ success: true, count: data.length });
        }
        return Response.json({ error: 'Failed to create interviews' }, { status: 500 });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    try {
        const { email, jobId, updates } = await request.json();
        
        if (!adminSupabase) return Response.json({ error: 'Admin Supabase not configured' }, { status: 500 });

        const { data, error } = await adminSupabase
            .from('interviews')
            .update(updates)
            .eq('candidate_email', email)
            .eq('job_id', jobId)
            .select();

        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ success: true, data });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
