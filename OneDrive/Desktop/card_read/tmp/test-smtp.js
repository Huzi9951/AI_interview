const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testSmtp() {
    console.log('Starting SMTP test...');
    console.log('SMTP_HOST:', process.env.SMTP_HOST);
    console.log('SMTP_PORT:', process.env.SMTP_PORT);
    console.log('SMTP_EMAIL:', process.env.SMTP_EMAIL);

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
        },
        tls: {
            rejectUnauthorized: false,
        },
    });

    const mailOptions = {
        from: `"SMTP Test" <${process.env.SMTP_EMAIL}>`,
        to: 'huzaifa772070@gmail.com',
        subject: 'SMTP Configuration Test',
        text: 'Hello, this is a test email to verify the SMTP configuration in the AI interview platform.',
        html: '<b>Hello,</b><p>This is a test email to verify the SMTP configuration in the AI interview platform.</p>',
    };

    try {
        console.log('Sending email...');
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully!');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

testSmtp();
