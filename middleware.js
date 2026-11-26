import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// Routes that require Supabase authentication
const PROTECTED_PAGE_PREFIXES = ['/dashboard'];

const PROTECTED_API_ROUTES = new Set([
    '/api/jobs',
    '/api/candidates',
    '/api/interviews',
    '/api/send-invite',
    '/api/invite-member',
    '/api/delete-candidate',
    '/api/delete-job',
    '/api/clear-db',
    '/api/init-db',
    '/api/list-users',
]);

// API routes that candidates use (no HR auth needed)
const PUBLIC_API_PREFIXES = [
    '/api/interviews/',   // /api/interviews/[id] — candidate access
    '/api/ai',            // Groq proxy — used during interviews
    '/api/verify-token',  // Token verification
    '/api/upload-recording', // Candidate uploads
];

export async function middleware(request) {
    const { pathname } = request.nextUrl;

    // --- Determine if this route needs protection ---
    const isProtectedPage = PROTECTED_PAGE_PREFIXES.some(p => pathname.startsWith(p));
    const isProtectedApi = PROTECTED_API_ROUTES.has(pathname);
    const isPublicApi = PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p));

    // If not a protected route, pass through
    if (!isProtectedPage && !isProtectedApi) return NextResponse.next();

    // Public API sub-routes (e.g. /api/interviews/[id]) are allowed
    if (isPublicApi) return NextResponse.next();

    // --- Supabase env check ---
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        // If Supabase is not configured, BLOCK access (fail-closed)
        if (isProtectedApi) {
            return NextResponse.json(
                { error: 'Authentication service not configured' },
                { status: 503 }
            );
        }
        // For pages: redirect to login with an error
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/';
        loginUrl.searchParams.set('error', 'auth_unavailable');
        return NextResponse.redirect(loginUrl);
    }

    // --- Validate Supabase session from cookies ---
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) =>
                    request.cookies.set(name, value)
                );
                supabaseResponse = NextResponse.next({ request });
                cookiesToSet.forEach(({ name, value, options }) =>
                    supabaseResponse.cookies.set(name, value, options)
                );
            },
        },
    });

    let { data: { user } } = await supabase.auth.getUser();

    // Fallback: Check standard Authorization header
    if (!user) {
        const authHeader = request.headers.get('Authorization');
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: headerData } = await supabase.auth.getUser(token);
            if (headerData?.user) {
                user = headerData.user;
            }
        }
    }

    if (!user) {
        if (isProtectedApi) {
            return NextResponse.json(
                { error: 'Unauthorized — please sign in' },
                { status: 401 }
            );
        }
        // Redirect to login for protected pages
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/';
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        '/dashboard/:path*',
        '/api/jobs/:path*',
        '/api/candidates/:path*',
        '/api/interviews',
        '/api/interviews/:path*',
        '/api/send-invite/:path*',
        '/api/invite-member/:path*',
        '/api/delete-candidate/:path*',
        '/api/delete-job/:path*',
        '/api/clear-db/:path*',
        '/api/init-db/:path*',
        '/api/list-users/:path*',
    ],
};
