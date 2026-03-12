export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');

        const { fetchAllInterviewsFromDB, getInterviewsByEmail } = await import('@/lib/db');

        let interviews;
        if (email) {
            interviews = await getInterviewsByEmail(email);
        } else {
            interviews = await fetchAllInterviewsFromDB();
        }

        return Response.json({ success: true, interviews });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
