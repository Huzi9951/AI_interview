import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export async function POST(request) {
    const { response: authError } = await requireAuth({ roles: ['ADMIN'] });
    if (authError) return authError;

    if (!supabase) {
        return Response.json({ error: 'Supabase credentials not configured' }, { status: 500 });
    }

    try {
        const { email } = await request.json();

        if (!email) {
            return Response.json({ error: 'Missing email' }, { status: 400 });
        }

        // 1. Get all interviews for this email
        const { data: interviews, error: fetchError } = await supabase
            .from('interviews')
            .select('id, recording_url')
            .eq('candidate_email', email);

        if (fetchError) {
            return Response.json({ error: fetchError.message }, { status: 500 });
        }

        // 2. Delete recordings from storage
        const filesToDelete = interviews
            .filter(i => i.recording_url)
            .map(i => {
                try {
                    const urlObj = new URL(i.recording_url);
                    const parts = urlObj.pathname.split('/');
                    const idx = parts.indexOf('interview-recordings');
                    if (idx !== -1 && idx < parts.length - 1) {
                        return parts.slice(idx + 1).join('/');
                    }
                } catch (e) {
                    return null;
                }
                return null;
            })
            .filter(Boolean);

        if (filesToDelete.length > 0) {
            const { error: storageError } = await supabase.storage
                .from('interview-recordings')
                .remove(filesToDelete);

            if (storageError) {
                console.error('Storage delete error:', storageError);
                // Continue to DB deletion anyway
            }
        }

        // 3. Delete from DB (Interviews)
        const { error: interviewDeleteError } = await supabase
            .from('interviews')
            .delete()
            .eq('candidate_email', email);

        if (interviewDeleteError) {
            console.error('Interview delete error:', interviewDeleteError);
            return Response.json({ error: interviewDeleteError.message }, { status: 500 });
        }

        // 4. Delete candidate record
        const { error: candidateDeleteError } = await supabase
            .from('candidates')
            .delete()
            .eq('email', email);

        if (candidateDeleteError) {
            console.error('Candidate delete error:', candidateDeleteError);
            return Response.json({ error: candidateDeleteError.message }, { status: 500 });
        }

        return Response.json({ success: true, deletedInterviewsCount: interviews?.length || 0, deletedFilesCount: filesToDelete.length });

    } catch (err) {
        console.error('API delete error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
