import { requireAuth } from '@/lib/auth';
import { signToken } from '@/lib/tokenService';
import nodemailer from 'nodemailer';

export async function POST(request) {
    const { response: authError } = await requireAuth({ roles: ['ADMIN', 'TEAM_MEMBER'] });
    if (authError) return authError;

    try {
        const body = await request.json();
        const { candidates, jobTitle, jobId, jobDescription, companyName, expiryHours, customQuestions, questionCount } = body;

        const effectiveCompanyName = companyName || 'HyperEval';

        if (!candidates || !candidates.length || !jobTitle) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: process.env.SMTP_SECURE === 'true',
            pool: true,
            maxConnections: 10,
            maxMessages: 100,
            auth: {
                user: process.env.SMTP_EMAIL,
                pass: process.env.SMTP_PASSWORD,
            },
            tls: {
                rejectUnauthorized: process.env.NODE_ENV === 'production',
            },
        });

        const origin = request.headers.get('origin') || request.headers.get('referer')?.replace(/\/api.*/, '') || 'http://localhost:3000';

        const interviewRecordsToInsert = [];
        const emailPromises = candidates.map(candidate => {
            return new Promise(async (resolve) => {
                try {
                    const tokenData = {
                        email: candidate.email,
                        name: candidate.name || '',
                        jobTitle,
                        jobId,
                        jobDescription: jobDescription || '',
                        customQuestions: customQuestions || [],
                        questionCount: questionCount || (customQuestions || []).length || 6,
                        expiresAt: Date.now() + (expiryHours || 48) * 60 * 60 * 1000,
                        createdAt: Date.now(),
                    };

                    // HMAC-signed token instead of raw base64
                    const token = signToken(tokenData);
                    const inviteLink = `${origin}/accept?token=${encodeURIComponent(token)}`;
                    const tokenHash = Buffer.from(candidate.email + ':' + jobTitle + ':' + tokenData.createdAt).toString('base64').replace(/[^a-zA-Z0-9]/g, '');

                    interviewRecordsToInsert.push({
                        candidateEmail: candidate.email,
                        candidateName: candidate.name || '',
                        jobTitle,
                        jobId: jobId || '',
                        tokenHash,
                        customQuestions: customQuestions || [],
                        resumeText: candidate.resumeText || '',
                        resumeMatchScore: candidate.matchScore || 0,
                    });

                    const html = `
                    <!DOCTYPE html>
                    <html>
                    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
                        <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 16px; border: 1px solid #e8e8ef; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                            <div style="text-align: center; margin-bottom: 32px;">
                                <h1 style="color: #e8604c; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.02em;">Hyper<span style="color: #1a1a2e;">Eval</span></h1>
                                <p style="color: #64748b; margin: 4px 0 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">AI-Powered Interview Platform</p>
                            </div>
                            <div style="margin-bottom: 32px;">
                                <p style="font-size: 18px; color: #1a1a2e; font-weight: 700; margin-bottom: 16px;">Hi ${candidate.name || 'there'},</p>
                                <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 16px;">
                                    You have been invited to an AI-powered technical interview for the position of
                                    <strong style="color: #e8604c;">${jobTitle}</strong> at <strong>${effectiveCompanyName}</strong>.
                                </p>
                                <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #f1f5f9; margin-bottom: 24px;">
                                    <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0;">
                                        This interview is conducted by our AI assistant. It will evaluate your technical depth, domain knowledge, and problem-solving skills in real-time.
                                    </p>
                                </div>
                                <div style="display: flex; gap: 20px; margin-bottom: 32px;">
                                    <p style="font-size: 13px; color: #64748b; margin: 0;">
                                        ⏰ Invitation expires in: <strong>${expiryHours || 48} hours</strong>
                                    </p>
                                </div>
                            </div>
                            <div style="text-align: center; margin-bottom: 32px;">
                                <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #e8604c, #f0845e); color: #ffffff; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 10px 20px rgba(232, 96, 76, 0.2);">
                                    Accept & Start Interview →
                                </a>
                            </div>
                            <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; text-align: center;">
                                <p style="font-size: 12px; color: #94a3b8; line-height: 1.5;">
                                    For the best experience, please use <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>.<br/>
                                    Ensure you have a stable internet connection and a working camera/microphone.
                                </p>
                            </div>
                        </div>
                        <div style="text-align: center; margin-top: 24px;">
                            <p style="font-size: 12px; color: #94a3b8;">
                                Powered by ${effectiveCompanyName} • The Future of Intelligent Hiring
                            </p>
                        </div>
                    </body>
                    </html>`;

                    await transporter.sendMail({
                        from: `"${effectiveCompanyName}" <${process.env.SMTP_EMAIL}>`,
                        to: candidate.email,
                        subject: `Interview Invitation: ${jobTitle} — ${effectiveCompanyName}`,
                        html,
                    });

                    resolve({ email: candidate.email, success: true });
                } catch (err) {
                    console.error(`Failed to send to ${candidate.email}:`, err.message);
                    resolve({ email: candidate.email, success: false, error: err.message });
                }
            });
        });

        const resultsArray = await Promise.allSettled(emailPromises);
        const results = resultsArray.map(r => r.value);

        if (interviewRecordsToInsert.length > 0) {
            try {
                const { createInterviewsBatch } = await import('@/lib/db.js');
                await createInterviewsBatch(interviewRecordsToInsert);
            } catch (dbErr) {
                console.warn('Batch DB record creation skipped:', dbErr.message);
            }
        }

        const successCount = results.filter(r => r.success).length;
        return Response.json({
            success: true,
            message: `Sent ${successCount}/${candidates.length} emails`,
            results,
        });
    } catch (err) {
        console.error('Send invite API error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
