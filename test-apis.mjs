import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';

dotenv.config({ path: '.env' });

const logFile = 'api-test-results.txt';
fs.writeFileSync(logFile, ''); // clear log
const log = (msg) => {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    log('Missing Supabase Environment Variables. Tests aborted.');
    process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
const authSupabase = createClient(supabaseUrl, supabaseAnonKey);

const TEST_EMAIL = `testadmin_${crypto.randomBytes(4).toString('hex')}@hypereval.local`;
const TEST_PASSWORD = 'TestPassword123!';
const BASE_URL = 'http://localhost:3000';

async function runTests() {
    log('--- HyperEval API Integration Tests ---');
    log(`Setting up temporary admin: ${TEST_EMAIL}`);

    // 1. Create Admin User
    const { data: userCreated, error: createError } = await adminSupabase.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: { role: 'ADMIN', name: 'Test Admin' }
    });

    if (createError) {
        log('Failed to create test user:', createError.message);
        return;
    }

    const testUserId = userCreated.user.id;

    try {
        // 2. Sign In to get session cookies
        const { data: sessionData, error: loginError } = await authSupabase.auth.signInWithPassword({
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
        });

        if (loginError || !sessionData.session) {
            log('Failed to authenticate test user:', loginError?.message);
            throw new Error('Login failed');
        }

        const accessToken = sessionData.session.access_token;
        const refreshToken = sessionData.session.refresh_token;

        // Construct Supabase SSR cookies string (approximate for Next.js middleware)
        // Actually, Supabase SSR uses chunked cookies sometimes, but for simple auth header:
        // We can just pass the Auth header. Let's see if middleware accepts it.
        // Wait, middleware in Next.js using @supabase/ssr usually checks cookies.
        // Let's pass the cookies directly based on default supabase names:
        // 'sb-' + PROJECT_REF + '-auth-token'
        
        const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
        const authCookieName = `sb-${projectRef}-auth-token`;
        
        // Supabase SSR uses JSON chunking
        const stringifiedSession = JSON.stringify([accessToken, refreshToken]);
        
        // Let's create the chunks
        const chunkSize = 3000;
        let cookieBuilder = [];
        for (let i = 0; i < Math.ceil(stringifiedSession.length / chunkSize); i++) {
            const chunk = stringifiedSession.slice(i * chunkSize, (i + 1) * chunkSize);
            cookieBuilder.push(`${authCookieName}.${i}=${encodeURIComponent(chunk)}`);
        }
        
        const headers = {
            'Content-Type': 'application/json',
            'Cookie': cookieBuilder.join('; '),
            'Authorization': `Bearer ${accessToken}`
        };

        const executeRequest = async (method, path, body = undefined) => {
            const url = `${BASE_URL}${path}`;
            log(`\nTesting [${method}] ${path}...`);
            const res = await fetch(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined
            });
            
            const contentType = res.headers.get('content-type');
            let data;
            if (contentType && contentType.includes('application/json')) {
                data = await res.json();
            } else {
                data = await res.text();
            }

            if (res.ok) {
                log(`✅ Success (${res.status})`);
            } else {
                log(`❌ Failed (${res.status}):`, data);
            }
            return { status: res.status, data };
        };

        // --- Run API Tests ---
        
        // 1. Test /api/jobs (POST, PATCH, DELETE)
        let jobId = null;
        const jobRes = await executeRequest('POST', '/api/jobs', {
            title: 'Automated Test Software Engineer',
            description: 'A test job created by automated integration suite'
        });
        if (jobRes.status === 200 && jobRes.data.success) {
            jobId = jobRes.data.job.id;
            log(`   Created Job ID: ${jobId}`);
            
            await executeRequest('PATCH', '/api/jobs', {
                id: jobId,
                employmentType: 'Full-time'
            });
        }

        // 2. Test /api/candidates (POST)
        let candidateId = null;
        const candRes = await executeRequest('POST', '/api/candidates', {
            candidates: [{
                name: 'Jane Doe',
                email: `janedoe_${Date.now()}@example.com`,
                phone: '1234567890'
            }]
        });
        if (candRes.status === 200 && candRes.data.success) {
            candidateId = candRes.data.candidates[0].id;
        }

        // 3. Test /api/interviews (GET, POST, PATCH)
        let interviewId = null;
        if (jobId && candidateId) {
            const intRes = await executeRequest('POST', '/api/interviews', {
                interviews: [{
                    candidateEmail: candRes.data.candidates[0].email,
                    candidateName: 'Jane Doe',
                    jobTitle: 'Automated Test Software Engineer',
                    jobId: jobId,
                    status: 'assigned',
                }]
            });
            if (intRes.status === 200 && intRes.data.success) {
                // PATCH interviews specific endpoint
                await executeRequest('PATCH', `/api/interviews/${intRes.data.ids[0]}`, {
                    status: 'interviewed',
                    overall_score: 85
                });
            }
        }
        await executeRequest('GET', '/api/interviews');

        // 4. Test /api/list-users (GET)
        await executeRequest('GET', '/api/list-users');

        // 5. Cleanup Database Objects
        if (jobId) {
            log('\nCleaning up Job...');
            await executeRequest('POST', '/api/delete-job', { jobId });
        }
        if (candidateId) {
           log('Cleaning up Candidate...');
           await executeRequest('POST', '/api/delete-candidate', { email: candRes.data.candidates[0].email });
        }


    } catch (e) {
        log('Test Suite encountered a critical error:', e);
    } finally {
        // 5. Cleanup Admin User
        log(`\nCleaning up temporary admin user: ${testUserId}...`);
        await adminSupabase.auth.admin.deleteUser(testUserId);
        log('Done.');
    }
}

runTests();
