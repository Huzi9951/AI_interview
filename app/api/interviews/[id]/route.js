export const dynamic = 'force-dynamic';

// Allowed fields that candidates/system can update on interview records
const ALLOWED_UPDATE_FIELDS = new Set([
    'status', 'started_at', 'completed_at', 'questions', 'violations',
    'report_data', 'overall_score', 'hire_recommendation', 'recording_url',
    'skill_analysis',
]);

export async function GET(request, { params }) {
    try {
        const { id } = await params;
        if (!id) {
            return Response.json({ error: 'Missing interview ID' }, { status: 400 });
        }
        const { getInterviewById } = await import('@/lib/db');
        const interview = await getInterviewById(id);
        if (!interview) {
            return Response.json({ error: 'Interview not found' }, { status: 404 });
        }
        return Response.json({ success: true, interview });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(request, { params }) {
    try {
        const { id } = await params;
        const rawUpdates = await request.json();

        if (!id) {
            return Response.json({ error: 'Missing interview ID' }, { status: 400 });
        }

        // Whitelist update fields — prevent arbitrary column writes
        const updates = {};
        for (const [key, value] of Object.entries(rawUpdates)) {
            if (ALLOWED_UPDATE_FIELDS.has(key)) {
                updates[key] = value;
            }
        }

        if (Object.keys(updates).length === 0) {
            return Response.json({ error: 'No valid update fields provided' }, { status: 400 });
        }

        const { adminSupabase } = await import('@/lib/supabaseClient');
        if (!adminSupabase) {
            return Response.json({ error: 'Admin Supabase not configured' }, { status: 500 });
        }

        const { data, error } = await adminSupabase
            .from('interviews')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json({ success: true, interview: data });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
