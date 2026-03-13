export const dynamic = 'force-dynamic';

async function handleInit() {
    try {
        const { adminSupabase: supabase } = await import('@/lib/supabaseClient');

        if (!supabase) {
            return Response.json({ error: 'Supabase admin not configured' }, { status: 500 });
        }

        const { error } = await supabase.rpc('exec_sql', {
            sql: `
                -- Create tables if not exist
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
                    resume_match_score INTEGER DEFAULT 0,
                    hire_recommendation TEXT DEFAULT '',
                    resume_text TEXT DEFAULT '',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    UNIQUE(candidate_email, job_id)
                );

                CREATE TABLE IF NOT EXISTS jobs (
                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    skills TEXT[] DEFAULT '{}',
                    status TEXT DEFAULT 'open',
                    location_type TEXT,
                    location TEXT,
                    experience_level TEXT,
                    experience_range TEXT,
                    employment_type TEXT,
                    department TEXT,
                    must_have JSONB DEFAULT '[]',
                    preferred JSONB DEFAULT '[]',
                    salary_min INTEGER,
                    salary_max INTEGER,
                    currency TEXT DEFAULT 'USD',
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS candidates (
                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    name TEXT,
                    email TEXT UNIQUE NOT NULL,
                    phone TEXT,
                    designation TEXT,
                    company TEXT,
                    resume_text TEXT,
                    source TEXT,
                    added_at TIMESTAMPTZ DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS members (
                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    role TEXT NOT NULL,
                    name TEXT DEFAULT '',
                    assigned_jobs UUID[] DEFAULT '{}',
                    invited_at TIMESTAMPTZ DEFAULT NOW()
                );

                -- Migrations for existing tables
                DO $$ 
                BEGIN 
                    -- Candidates table migrations
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidates' AND column_name='resume_text') THEN
                        ALTER TABLE candidates ADD COLUMN resume_text TEXT;
                    END IF;

                    -- Interviews table migrations
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interviews' AND column_name='resume_match_score') THEN
                        ALTER TABLE interviews ADD COLUMN resume_match_score INTEGER DEFAULT 0;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interviews' AND column_name='hire_recommendation') THEN
                        ALTER TABLE interviews ADD COLUMN hire_recommendation TEXT DEFAULT '';
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interviews' AND column_name='resume_text') THEN
                        ALTER TABLE interviews ADD COLUMN resume_text TEXT DEFAULT '';
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interviews' AND column_name='skill_analysis') THEN
                        ALTER TABLE interviews ADD COLUMN skill_analysis JSONB DEFAULT '{}';
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interviews' AND column_name='token_hash') THEN
                        ALTER TABLE interviews ADD COLUMN token_hash TEXT;
                    END IF;
                END $$;

                CREATE INDEX IF NOT EXISTS idx_interviews_token ON interviews(token_hash);
                CREATE INDEX IF NOT EXISTS idx_interviews_email ON interviews(candidate_email);
                CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
            `
        });

        if (error) {
            console.error('Init DB Error:', error);
            // Fallback: suggest manual SQL if RPC fails
            return Response.json({
                success: false,
                message: 'Admin RPC "exec_sql" might be missing. Try running the SQL manually in Supabase Dashboard.',
                error: error.message
            });
        }

        return Response.json({ success: true, message: 'Database initialized/migrated successfully.' });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function GET() {
    return handleInit();
}

export async function POST() {
    return handleInit();
}
