import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { adminSupabase } from '@/lib/supabaseClient';

export async function GET() {
    const { response: authError } = await requireAuth({ roles: ['ADMIN'] });
    if (authError) return authError;

    try {
        if (!adminSupabase) {
            return NextResponse.json({ error: 'Supabase Admin not configured' }, { status: 500 });
        }

        const { data: { users }, error } = await adminSupabase.auth.admin.listUsers();
        if (error) throw error;

        return NextResponse.json({
            users: users.map(u => ({
                id: u.id,
                email: u.email,
                metadata: u.user_metadata,
            })),
        });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
