import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function POST(req) {
    const { response: authError } = await requireAuth({ roles: ['ADMIN'] });
    if (authError) return authError;

    try {
        const { jobId } = await req.json();

        if (!jobId) {
            return NextResponse.json({ success: false, error: 'jobId is required' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.warn('SUPABASE_SERVICE_ROLE_KEY is missing. Using Anon Key. Deletions might fail due to RLS.');
            // Proceed gracefully using the anon key just in case it's sufficient for other operations
        }

        const adminClient = createClient(
            supabaseUrl,
            supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // 1. Fetch all interviews regarding this job to get recording URLs
        const { data: interviews, error: fetchError } = await adminClient
            .from('interviews')
            .select('id, recording_url')
            .eq('job_id', jobId);

        if (fetchError) {
            return NextResponse.json({ success: false, error: 'Failed to find associated interviews.' }, { status: 500 });
        }

        // 2. Delete the videos from Storage
        if (interviews && interviews.length > 0) {
            const filePaths = interviews
                .map(inv => {
                    if (!inv.recording_url) return null;
                    try {
                        // Extract relative path from absolute URL:
                        // "https://[ref].supabase.co/storage/v1/object/public/interview-recordings/abc.webm" -> "abc.webm"
                        const urlObj = new URL(inv.recording_url);
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

            if (filePaths.length > 0) {
                const { error: storageError } = await adminClient.storage
                    .from('interview-recordings')
                    .remove(filePaths);

                if (storageError) {
                    console.error('Failed to delete recordings from storage:', storageError);
                } else {
                    console.log(`Deleted ${filePaths.length} recordings from storage for jobId: ${jobId}`);
                }
            }
        }

        // 3. Delete all interview rows from Database where job_id === jobId
        const { error: deleteError } = await adminClient
            .from('interviews')
            .delete()
            .eq('job_id', jobId);

        if (deleteError) {
            throw deleteError;
        }

        return NextResponse.json({ success: true, count: interviews?.length || 0 });

    } catch (error) {
        console.error('API /delete-job error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
