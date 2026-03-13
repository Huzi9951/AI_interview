import { adminSupabase as supabase } from '@/lib/supabaseClient';

export async function POST(request) {
    if (!supabase) {
        return Response.json({ error: 'Supabase admin credentials not configured' }, { status: 500 });
    }

    try {
        const job = await request.json();
        console.log('API POST /api/jobs title:', job.title);

        const { data, error } = await supabase
            .from('jobs')
            .insert({
                title: job.title,
                // ... (rest of the fields)
                description: job.description || '',
                skills: job.skills || [],
                status: job.status || 'open',
                location_type: job.locationType || '',
                location: job.location || '',
                experience_level: job.experienceLevel || '',
                experience_range: job.experienceRange || '',
                employment_type: job.employmentType || '',
                department: job.department || '',
                must_have: job.mustHave || [],
                preferred: job.preferred || [],
                salary_min: job.salaryMin || null,
                salary_max: job.salaryMax || null,
                currency: job.currency || 'USD',
            })
            .select()
            .single();

        if (error) {
            return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json({ success: true, job: data });

    } catch (err) {
        console.error('API jobs POST error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    if (!supabase) {
        return Response.json({ error: 'Supabase admin credentials not configured' }, { status: 500 });
    }

    try {
        const { id, ...updates } = await request.json();

        if (!id) {
            return Response.json({ error: 'Missing job ID' }, { status: 400 });
        }

        // Map camelCase fields to snake_case if necessary
        const mappedUpdates = { ...updates };
        if (updates.locationType !== undefined) { mappedUpdates.location_type = updates.locationType; delete mappedUpdates.locationType; }
        if (updates.experienceLevel !== undefined) { mappedUpdates.experience_level = updates.experienceLevel; delete mappedUpdates.experienceLevel; }
        if (updates.experienceRange !== undefined) { mappedUpdates.experience_range = updates.experienceRange; delete mappedUpdates.experienceRange; }
        if (updates.employmentType !== undefined) { mappedUpdates.employment_type = updates.employmentType; delete mappedUpdates.employmentType; }
        if (updates.mustHave !== undefined) { mappedUpdates.must_have = updates.mustHave; delete mappedUpdates.mustHave; }
        if (updates.salaryMin !== undefined) { mappedUpdates.salary_min = updates.salaryMin; delete mappedUpdates.salaryMin; }
        if (updates.salaryMax !== undefined) { mappedUpdates.salary_max = updates.salaryMax; delete mappedUpdates.salaryMax; }

        const { data, error } = await supabase
            .from('jobs')
            .update(mappedUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json({ success: true, job: data });

    } catch (err) {
        console.error('API jobs PATCH error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    if (!supabase) {
        return Response.json({ error: 'Supabase admin credentials not configured' }, { status: 500 });
    }

    try {
        const { id } = await request.json();

        if (!id) {
            return Response.json({ error: 'Missing job ID' }, { status: 400 });
        }

        // 1. Delete associated interviews/assignments first
        const { error: interviewError } = await supabase
            .from('interviews')
            .delete()
            .eq('job_id', id);

        if (interviewError) {
            console.error('API jobs DELETE (interviews) error:', interviewError);
        }

        // 2. Delete the job itself
        const { error: jobError } = await supabase
            .from('jobs')
            .delete()
            .eq('id', id);

        if (jobError) {
            return Response.json({ error: jobError.message }, { status: 500 });
        }

        return Response.json({ success: true });

    } catch (err) {
        console.error('API jobs DELETE error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
