export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const { token } = await request.json();

        if (!token) {
            return Response.json({ error: 'Missing token' }, { status: 400 });
        }

        const { verifyToken } = await import('@/lib/tokenService');
        const data = verifyToken(token);

        if (!data) {
            return Response.json({ error: 'Invalid or tampered token' }, { status: 401 });
        }

        if (data.expiresAt && Date.now() > data.expiresAt) {
            return Response.json({ error: 'Token expired', expired: true }, { status: 401 });
        }

        // Check completion status if tokenHash is derivable
        const tokenHash = Buffer.from(
            data.email + ':' + data.jobTitle + ':' + data.createdAt
        ).toString('base64').replace(/[^a-zA-Z0-9]/g, '');

        let alreadyDone = false;
        try {
            const { hasCompletedInterview } = await import('@/lib/db');
            alreadyDone = await hasCompletedInterview(tokenHash);
        } catch {
            // DB check optional
        }

        return Response.json({
            success: true,
            data,
            tokenHash,
            alreadyDone,
        });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
