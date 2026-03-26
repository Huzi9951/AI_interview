import { NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/supabaseClient';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

export async function GET() {
    try {
        if (!adminSupabase) {
            return NextResponse.json({ success: false, error: 'Supabase Admin is not configured' }, { status: 500 });
        }

        const { data, error } = await adminSupabase
            .from('members')
            .select('*')
            .order('invited_at', { ascending: false });

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, members: data });
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const { email, role, jobIds, companyName, name } = await req.json();

        if (!email || !role) {
            return NextResponse.json({ success: false, error: 'Email and role are required' }, { status: 400 });
        }

        if (!adminSupabase) {
            return NextResponse.json({ success: false, error: 'Supabase Admin is not configured' }, { status: 500 });
        }

        // 1. Generate a random password
        const password = crypto.randomBytes(6).toString('hex'); // 12 characters hex

        // 2. Aggressively find and delete existing record anywhere
        try {
            console.log(`[Invitation] Cleaning up existing data for: ${email}`);
            
            // 2.1. Clean up potential table remnants
            await adminSupabase.from('interviews').delete().eq('candidate_email', email.toLowerCase());
            await adminSupabase.from('candidates').delete().eq('email', email.toLowerCase());
            await adminSupabase.from('members').delete().eq('email', email.toLowerCase());

            // 2.2. Find and delete from Auth
            let foundUser = null;
            let page = 1;
            const perPage = 1000;

            while (!foundUser) {
                const { data: { users }, error: listError } = await adminSupabase.auth.admin.listUsers({
                    page,
                    perPage
                });

                if (listError || !users || users.length === 0) break;

                foundUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
                if (foundUser || users.length < perPage) break;
                page++;
            }

            if (foundUser) {
                console.log(`[Invitation] Found existing auth user (${foundUser.id}). Deleting...`);
                await adminSupabase.auth.admin.deleteUser(foundUser.id);
                // Wait for Supabase to sync
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        } catch (cleanupErr) {
            console.warn('[Invitation] Cleanup warning:', cleanupErr.message || cleanupErr);
        }

        // 3. Create user via Admin API
        const { data, error: createError } = await adminSupabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { 
                role, 
                assigned_jobs: jobIds || [],
                company_name: companyName,
                name: name || ''
            }
        });

        if (createError) {
            console.error('[Invitation] Final Create Error:', createError);
            return NextResponse.json({ 
                success: false, 
                error: `Auth Error: ${createError.message || 'Operation failed'}` 
            }, { status: 500 });
        }

        const user = data.user;
        console.log(`[Invitation] Successfully created user: ${user.email}`);

        // 3b. Upsert into members table
        const { error: memberError } = await adminSupabase
            .from('members')
            .upsert({
                email: email.toLowerCase(),
                role: role,
                name: name || '',
                assigned_jobs: jobIds || [],
                invited_at: new Date().toISOString()
            }, { onConflict: 'email' });

        if (memberError) {
            console.error('[Invitation] Member Table Error:', memberError);
        }

        // 4. Send Invitation Email
        const smtpConfig = {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '465'),
            secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
            auth: {
                user: process.env.SMTP_USERNAME || process.env.SMTP_EMAIL || process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS,
            },
        };

        const transporter = nodemailer.createTransport(smtpConfig);
        const loginUrl = `${req.nextUrl.origin}`;
        const fromEmail = process.env.SMTP_EMAIL || process.env.SMTP_USER || smtpConfig.auth.user;
        
        const mailOptions = {
            from: `"HyperEval" <${fromEmail}>`,
            to: email,
            subject: `Invitation to join ${companyName} on HyperEval`,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
                    <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 16px; border: 1px solid #e8e8ef; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                        <div style="text-align: center; margin-bottom: 32px;">
                            <h1 style="color: #e8604c; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.02em;">Hyper<span style="color: #1a1a2e;">Eval</span></h1>
                            <p style="color: #64748b; margin: 4px 0 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">AI-Powered Hiring Excellence</p>
                        </div>
                        
                        <div style="background-color: #f8fafc; padding: 25px; border-radius: 12px; margin-bottom: 25px; border: 1px solid #f1f5f9;">
                            <h2 style="margin-top: 0; color: #1a1a2e; font-size: 20px; font-weight: 800;">You've been invited!</h2>
                            <p style="color: #334155; line-height: 1.6; font-size: 15px;">
                                Hello ${name || ''}, you have been invited to join <strong>${companyName}</strong> as a <strong>${role.replace('_', ' ')}</strong> on HyperEval.
                            </p>
                        </div>

                        <div style="margin-bottom: 30px;">
                            <h3 style="color: #1a1a2e; font-size: 16px; margin-bottom: 15px; font-weight: 700;">Your Temporary Credentials:</h3>
                            <div style="background: #ffffff; border: 1px solid #e8e8ef; border-radius: 10px; overflow: hidden;">
                                <div style="padding: 14px; background-color: #f8fafc; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between;">
                                    <span style="color: #64748b; font-size: 13px; font-weight: 600;">Email:</span>
                                    <span style="color: #1a1a2e; font-size: 13px; font-weight: 700;">${email}</span>
                                </div>
                                <div style="padding: 14px; display: flex; justify-content: space-between; align-items: center;">
                                    <span style="color: #64748b; font-size: 13px; font-weight: 600;">Password:</span>
                                    <span style="color: #e8604c; font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 18px;">${password}</span>
                                </div>
                            </div>
                            <p style="font-size: 12px; color: #94a3b8; margin-top: 12px; font-style: italic;">Please change your password after your first login.</p>
                        </div>

                        <div style="text-align: center; margin-top: 40px;">
                            <a href="${loginUrl}" style="background: linear-gradient(135deg, #e8604c, #f0845e); color: #fff; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: 700; display: inline-block; font-size: 16px; box-shadow: 0 10px 20px rgba(232, 96, 76, 0.2);">Login to Dashboard</a>
                        </div>
                    </div>
                    <div style="text-align: center; margin-top: 24px;">
                        <p style="font-size: 12px; color: #94a3b8;">
                            Powered by HyperEval • The Future of Intelligent Hiring
                        </p>
                    </div>
                </div>
            `,
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`[Invitation] Email sent successfully to ${email}`);
        } catch (mailErr) {
            console.error('[Invitation] SMTP Error:', mailErr);
            return NextResponse.json({ 
                success: true, 
                message: 'User created, but email failed to send. Check credentials.',
                warning: mailErr.message 
            });
        }

        return NextResponse.json({ success: true, message: 'Invitation sent' });

    } catch (error) {
        console.error('[Invitation] Global Route Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
