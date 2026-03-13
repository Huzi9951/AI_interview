import { NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/supabaseClient';

export async function POST() {
    try {
        if (!adminSupabase) {
            return NextResponse.json({ success: false, error: 'Supabase Admin not configured' }, { status: 500 });
        }

        console.log('Starting full database cleanup (excluding jobs and primary users)...');

        // 1. Clear all recordings from storage
        const { data: files, error: listError } = await adminSupabase.storage
            .from('interview-recordings')
            .list('recordings');

        if (!listError && files && files.length > 0) {
            const filePaths = files.map(f => `recordings/${f.name}`);
            await adminSupabase.storage
                .from('interview-recordings')
                .remove(filePaths);
            console.log(`Cleared ${filePaths.length} recordings from storage.`);
        }

        // 2. Clear Interviews table
        const { error: interviewError } = await adminSupabase
            .from('interviews')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); 

        if (interviewError) console.error('Error clearing interviews:', interviewError);

        // 3. Clear Candidates table
        const { error: candidateError } = await adminSupabase
            .from('candidates')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (candidateError) console.error('Error clearing candidates:', candidateError);

        // 4. Clear Invited Users (Team Members and Clients)
        const { data: { users }, error: userListError } = await adminSupabase.auth.admin.listUsers();
        
        if (!userListError && users) {
           const usersToDelete = users.filter(u => 
                u.user_metadata?.role === 'TEAM_MEMBER' || 
                u.user_metadata?.role === 'CLIENT'
           );

           for (const user of usersToDelete) {
               const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(user.id);
               if (deleteError) {
                   console.error(`Error deleting user ${user.email}:`, deleteError);
               } else {
                   console.log(`Deleted invited user: ${user.email}`);
               }
           }
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Database and invited users cleared successfully (Jobs and primary users preserved)' 
        });

    } catch (error) {
        console.error('Clear DB Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
