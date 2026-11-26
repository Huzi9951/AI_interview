'use client';

import { createBrowserClient } from '@supabase/ssr';

let client = null;

/**
 * Cookie-aware Supabase browser client.
 * Sessions are stored in cookies (not localStorage), so Next.js middleware can read them.
 */
export function getSupabase() {
    if (!client) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (url && key) {
            client = createBrowserClient(url, key);
        }
    }
    return client;
}
