import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';

/**
 * Create a Supabase server client from the current request's cookies.
 * Works in Route Handlers and Server Components.
 */
export async function createServerSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;

    const cookieStore = await cookies();

    return createServerClient(url, key, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    );
                } catch {
                    // Cannot set cookies in read-only contexts (Server Components)
                }
            },
        },
    });
}

/**
 * Get the authenticated user from the current request cookies or Authorization header.
 * Returns the Supabase user object or null if not authenticated.
 */
export async function getAuthUser() {
    const supabase = await createServerSupabase();
    if (!supabase) return null;

    // First try standard cookie auth
    let { data: { user }, error } = await supabase.auth.getUser();
    
    // Fallback: Try Authorization Header
    if (error || !user) {
        const headersList = await headers();
        const authHeader = headersList.get('Authorization');
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: headerData } = await supabase.auth.getUser(token);
            if (headerData?.user) {
                return headerData.user;
            }
        }
    }

    if (error || !user) return null;
    return user;
}

/**
 * Require authentication for an API route handler.
 * Returns { user } on success, or a Response on failure.
 * @param {Object} options
 * @param {string[]} [options.roles] - Allowed roles (e.g. ['ADMIN', 'TEAM_MEMBER'])
 */
export async function requireAuth(options = {}) {
    const user = await getAuthUser();

    if (!user) {
        return {
            user: null,
            response: Response.json({ error: 'Unauthorized — please sign in' }, { status: 401 }),
        };
    }

    const userRole = user.user_metadata?.role || 'ADMIN';

    if (options.roles && !options.roles.includes(userRole)) {
        return {
            user,
            response: Response.json({ error: 'Forbidden — insufficient permissions' }, { status: 403 }),
        };
    }

    return { user, response: null };
}
