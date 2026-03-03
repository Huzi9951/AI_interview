export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        const { supabase } = await import('@/lib/supabaseClient');

        if (!supabase) {
            return Response.json({ error: 'Supabase not configured' }, { status: 500 });
        }

        const { error } = await supabase.rpc('exec_sql', {
            sql: `
                CREATE TABLE IF NOT EXISTS interviews (
                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    candidate_email TEXT NOT NULL,
                    candidate_name TEXT DEFAULT '',
                    job_title TEXT DEFAULT '',
                    job_id TEXT DEFAULT '',
                    status TEXT DEFAULT 'pending',
                    started_at TIMESTAMPTZ,
                    completed_at TIMESTAMPTZ,
                    recording_url TEXT,
                    report_data JSONB DEFAULT '{}',
                    questions JSONB DEFAULT '[]',
                    violations JSONB DEFAULT '[]',
                    skill_analysis JSONB DEFAULT '{}',
                    custom_questions JSONB DEFAULT '[]',
                    overall_score INTEGER DEFAULT 0,
                    hire_recommendation TEXT DEFAULT '',
                    token_hash TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_interviews_token ON interviews(token_hash);
                CREATE INDEX IF NOT EXISTS idx_interviews_email ON interviews(candidate_email);
                CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
            `
        });

        if (error) {
            return Response.json({
                success: false,
                message: 'Please create the table manually in Supabase SQL Editor. Copy the SQL below.',
                sql: `CREATE TABLE IF NOT EXISTS interviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    candidate_email TEXT NOT NULL,
    candidate_name TEXT DEFAULT '',
    job_title TEXT DEFAULT '',
    job_id TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    recording_url TEXT,
    report_data JSONB DEFAULT '{}',
    questions JSONB DEFAULT '[]',
    violations JSONB DEFAULT '[]',
    skill_analysis JSONB DEFAULT '{}',
    custom_questions JSONB DEFAULT '[]',
    overall_score INTEGER DEFAULT 0,
    hire_recommendation TEXT DEFAULT '',
    token_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_interviews_token ON interviews(token_hash);
CREATE INDEX IF NOT EXISTS idx_interviews_email ON interviews(candidate_email);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);`,
                error: error.message,
            });
        }

        return Response.json({ success: true, message: 'Database initialized successfully.' });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
