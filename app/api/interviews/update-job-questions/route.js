import { adminSupabase } from '@/lib/supabaseClient';
import { requireAuth } from '@/lib/auth';

export async function POST(request) {
    const { response: authError } = await requireAuth({ roles: ['ADMIN', 'TEAM_MEMBER'] });
    if (authError) return authError;

    if (!adminSupabase) {
        return Response.json({ error: 'Database not initialized' }, { status: 500 });
    }

    try {
        const { jobId, customQuestions } = await request.json();

        if (!jobId || !Array.isArray(customQuestions)) {
            return Response.json({ error: 'Missing jobId or invalid customQuestions' }, { status: 400 });
        }

        // Update strictly interviews that are only 'assigned' (not yet invited/completed)
        const { data, error } = await adminSupabase
            .from('interviews')
            .update({ custom_questions: customQuestions })
            .eq('job_id', jobId)
            .eq('status', 'assigned')
            .select();

        if (error) {
            console.error('Failed to update questions:', error.message);
            return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json({ success: true, count: data?.length || 0 });
    } catch (err) {
        console.error('API Error updating job questions:', err);
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
