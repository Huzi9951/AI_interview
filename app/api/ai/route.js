import Groq from 'groq-sdk';

export const dynamic = 'force-dynamic';

let groqClient = null;

function getGroq() {
    if (!groqClient) {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error('GROQ_API_KEY is not set in environment variables');
        }
        groqClient = new Groq({ apiKey });
    }
    return groqClient;
}

export async function POST(request) {
    try {
        const { action, messages, temperature } = await request.json();

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return Response.json({ error: 'Invalid or missing messages array' }, { status: 400 });
        }

        const groq = getGroq();

        if (action === 'chatText') {
            const response = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages,
                temperature: temperature ?? 0.7,
                max_tokens: 4096,
            });
            return Response.json({
                success: true,
                result: response.choices[0].message.content,
            });
        }

        // Default: JSON mode
        const response = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages,
            temperature: temperature ?? 0.7,
            max_tokens: 4096,
            response_format: { type: 'json_object' },
        });

        return Response.json({
            success: true,
            result: JSON.parse(response.choices[0].message.content),
        });
    } catch (err) {
        console.error('AI proxy error:', err.message);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
