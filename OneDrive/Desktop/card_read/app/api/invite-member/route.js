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
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #000; margin-bottom: 10px;">Hyper<span style="color: #6366f1;">Eval</span></h1>
                        <p style="color: #666; font-size: 16px;">AI-Powered Hiring Excellence</p>
                    </div>
                    
                    <div style="background-color: #f9fafb; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
                        <h2 style="margin-top: 0; color: #111; font-size: 20px;">You've been invited!</h2>
                        <p style="color: #444; line-height: 1.6;">
                            Hello ${name || ''}, you have been invited to join <strong>${companyName}</strong> as a <strong>${role.replace('_', ' ')}</strong> on HyperEval.
                        </p>
                    </div>

                    <div style="margin-bottom: 30px;">
                        <h3 style="color: #111; font-size: 16px; margin-bottom: 15px;">Your Temporary Credentials:</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 10px; background-color: #f3f4f6; border-radius: 6px 0 0 6px; color: #666; width: 100px;">Username:</td>
                                <td style="padding: 10px; background-color: #f3f4f6; border-radius: 0 6px 6px 0; font-weight: 600; color: #111;">${email}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; color: #666;">Password:</td>
                                <td style="padding: 10px; font-family: monospace; font-weight: 600; color: #4f46e5; font-size: 18px;">${password}</td>
                            </tr>
                        </table>
                        <p style="font-size: 13px; color: #999; margin-top: 10px;">Please change your password after your first login.</p>
                    </div>

                    <div style="text-align: center; margin-top: 40px; margin-bottom: 40px;">
                        <a href="${loginUrl}" style="background-color: #000; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block;">Login to Dashboard</a>
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
