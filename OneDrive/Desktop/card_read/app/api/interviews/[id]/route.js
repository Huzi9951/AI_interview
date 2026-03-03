export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
    try {
        const { id } = await params;
        if (!id) {
            return Response.json({ error: 'Missing interview ID' }, { status: 400 });
        }
        const { getInterviewById } = await import('@/lib/db');
        const interview = await getInterviewById(id);
        if (!interview) {
            return Response.json({ error: 'Interview not found' }, { status: 404 });
        }
        return Response.json({ success: true, interview });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
