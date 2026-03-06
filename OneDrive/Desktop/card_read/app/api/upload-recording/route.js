import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// We need the service role key to bypass RLS for uploads, 
// if it's not available, it'll try with anon key and might fail depending on RLS
// User should add SUPABASE_SERVICE_ROLE_KEY to .env for best results.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export async function POST(request) {
    if (!supabase) {
        return Response.json({ error: 'Supabase credentials not configured' }, { status: 500 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const interviewId = formData.get('interviewId');

        if (!file || !interviewId) {
            return Response.json({ error: 'Missing file or interviewId' }, { status: 400 });
        }

        const fileName = `recordings/${interviewId}_${Date.now()}.webm`;

        const { data, error } = await supabase.storage
            .from('interview-recordings')
            .upload(fileName, file, {
                contentType: file.type || 'video/webm',
                upsert: false,
            });

        if (error) {
            console.error('Supabase upload error:', error);
            return Response.json({ error: error.message }, { status: 500 });
        }

        const { data: urlData } = supabase.storage
            .from('interview-recordings')
            .getPublicUrl(fileName);

        return Response.json({ success: true, url: urlData?.publicUrl });

    } catch (err) {
        console.error('API upload error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
