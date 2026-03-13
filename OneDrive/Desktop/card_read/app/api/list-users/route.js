import { NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/supabaseClient';

export async function GET() {
    try {
        if (!adminSupabase) {
            return NextResponse.json({ error: 'Supabase Admin not configured' }, { status: 500 });
        }

        const { data: { users }, error } = await adminSupabase.auth.admin.listUsers();
        if (error) throw error;

        return NextResponse.json({ users: users.map(u => ({ id: u.id, email: u.email, metadata: u.user_metadata })) });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
