import nodemailer from 'nodemailer';

export async function POST(request) {
    try {
        const body = await request.json();
        const { candidates, jobTitle, jobId, jobDescription, expiryHours, customQuestions, questionCount } = body;

        if (!candidates || !candidates.length || !jobTitle) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: false,
            auth: {
                user: process.env.SMTP_EMAIL,
                pass: process.env.SMTP_PASSWORD,
            },
            tls: {
                rejectUnauthorized: false,
            },
        });

        const origin = request.headers.get('origin') || request.headers.get('referer')?.replace(/\/api.*/, '') || 'http://localhost:3000';
        const results = [];

        for (const candidate of candidates) {
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

                const token = Buffer.from(JSON.stringify(tokenData)).toString('base64url');
                const inviteLink = `${origin}/accept?token=${token}`;

                // Create a pending interview record in Supabase
                const tokenHash = Buffer.from(candidate.email + ':' + jobTitle + ':' + tokenData.createdAt).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
                try {
                    const { createInterview } = await import('@/lib/db.js');
                    await createInterview({
                        candidateEmail: candidate.email,
                        candidateName: candidate.name || '',
                        jobTitle,
                        jobId: jobId || '',
                        tokenHash,
                        customQuestions: customQuestions || [],
                    });
                } catch (dbErr) {
                    console.warn('DB record creation skipped:', dbErr.message);
                }

                const html = `
                <!DOCTYPE html>
                <html>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background: #f5f5f5;">
                    <div style="background: linear-gradient(135deg, #e8604c, #d4543f); padding: 32px 24px; text-align: center;">
                        <h1 style="color: #fff; margin: 0; font-size: 24px;">HyperHire</h1>
                        <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">AI-Powered Interview Platform</p>
                    </div>
                    <div style="background: #fff; padding: 32px 24px;">
                        <p style="font-size: 16px; color: #1a1a2e;">Hi ${candidate.name || 'there'},</p>
                        <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">
                            You have been invited to take an AI-powered interview for the position of
                            <strong style="color: #e8604c;">${jobTitle}</strong>.
                        </p>
                        <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">
                            This interview will be conducted by our AI interviewer and will assess your technical skills,
                            problem-solving abilities, and domain expertise. Please ensure you are in a quiet environment
                            with a stable internet connection.
                        </p>
                        <p style="font-size: 13px; color: #9ca3af; margin: 16px 0 8px;">
                            ⏰ This invite expires in <strong>${expiryHours || 48} hours</strong>.
                        </p>
                        <p style="font-size: 13px; color: #9ca3af;">
                            💡 For best experience, use <strong>Microsoft Edge</strong> or <strong>Google Chrome</strong>.
                        </p>
                        <div style="text-align: center; margin: 28px 0;">
                            <a href="${inviteLink}" style="display: inline-block; background: #e8604c; color: #fff; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">
                                Accept & Start Interview →
                            </a>
                        </div>
                        <p style="font-size: 12px; color: #b0b0bf; text-align: center;">
                            If the button doesn't work, copy this link:<br/>
                            <a href="${inviteLink}" style="color: #e8604c; word-break: break-all;">${inviteLink}</a>
                        </p>
                    </div>
                    <div style="background: #f8f9fa; padding: 20px 24px; text-align: center;">
                        <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                            Powered by HyperHire • AI-Driven Hiring Platform
                        </p>
                    </div>
                </body>
                </html>`;

                await transporter.sendMail({
                    from: `"HyperHire" <${process.env.SMTP_EMAIL}>`,
                    to: candidate.email,
                    subject: `Interview Invitation: ${jobTitle} — HyperHire`,
                    html,
                });

                results.push({ email: candidate.email, success: true, inviteLink });
            } catch (err) {
                console.error(`Failed to send to ${candidate.email}:`, err.message);
                results.push({ email: candidate.email, success: false, error: err.message });
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
