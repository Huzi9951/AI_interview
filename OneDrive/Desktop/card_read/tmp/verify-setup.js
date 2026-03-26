
const fs = require('fs');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function verify() {
    let output = '--- VisionHire AI Verification ---\n';
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        output += '❌ Supabase URL or Key missing in .env\n';
        fs.writeFileSync('tmp/verify-results.txt', output);
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const tables = ['interviews', 'candidates', 'jobs', 'members'];
    
    output += 'Checking Supabase connection and tables...\n';
    for (const table of tables) {
        try {
            const { error } = await supabase.from(table).select('id').limit(1);
            if (error) {
                if (error.code === '42P01') {
                    output += `❌ Table "${table}" does not exist.\n`;
                } else {
                    output += `❌ Error checking table "${table}": ${error.message}\n`;
                }
            } else {
                output += `✅ Table "${table}" found.\n`;
            }
        } catch (e) {
            output += `❌ Exception checking table "${table}": ${e.message}\n`;
        }
    }

    output += '\nChecking other API keys...\n';
    output += process.env.NEXT_PUBLIC_GROQ_API_KEY ? '✅ Groq API Key found.\n' : '❌ Groq API Key missing.\n';
    output += process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY ? '✅ Deepgram API Key found.\n' : '❌ Deepgram API Key missing.\n';
    
    output += '\nChecking SMTP configuration...\n';
    output += `Host: ${process.env.SMTP_HOST}\n`;
    output += `Port: ${process.env.SMTP_PORT}\n`;
    output += `User: ${process.env.SMTP_EMAIL || process.env.SMTP_USERNAME}\n`;
    
    output += '\nDone.\n';
    fs.writeFileSync('tmp/verify-results.txt', output);
    console.log('Results written to tmp/verify-results.txt');
}

verify().catch(err => {
    fs.appendFileSync('tmp/verify-results.txt', `\nFATAL ERROR: ${err.message}\n`);
    process.exit(1);
});
