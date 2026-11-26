import { requireAuth } from '@/lib/auth';
import { adminSupabase as supabase } from '@/lib/supabaseClient';

export async function POST(request) {
    const { response: authError } = await requireAuth({ roles: ['ADMIN', 'TEAM_MEMBER'] });
    if (authError) return authError;

    if (!supabase) {
        return Response.json({ error: 'Supabase admin credentials not configured' }, { status: 500 });
    }

    try {
        const body = await request.json();
        const { candidates } = body;

        if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
            return Response.json({ error: 'Missing or invalid candidates array' }, { status: 400 });
        }

        const { data, error } = await supabase
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

        if (error) {
            return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json({ success: true, count: data?.length || 0, candidates: data });

    } catch (err) {
        console.error('API candidates POST error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    const { response: authError } = await requireAuth({ roles: ['ADMIN', 'TEAM_MEMBER'] });
    if (authError) return authError;

    if (!supabase) {
        return Response.json({ error: 'Supabase admin credentials not configured' }, { status: 500 });
    }

    try {
        const { id, updates } = await request.json();

        if (!id || !updates) {
            return Response.json({ error: 'Missing candidate ID or updates' }, { status: 400 });
        }

        const mappedUpdates = { ...updates };
        if (updates.resumeText !== undefined) { mappedUpdates.resume_text = updates.resumeText; delete mappedUpdates.resumeText; }

        const { data, error } = await supabase
            .from('candidates')
            .update(mappedUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json({ success: true, candidate: data });

    } catch (err) {
        console.error('API candidates PATCH error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
