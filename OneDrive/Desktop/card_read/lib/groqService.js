import Groq from 'groq-sdk';

let groqClient = null;

function getGroq() {
    if (!groqClient) {
        const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
        if (!apiKey) {
            throw new Error('NEXT_PUBLIC_GROQ_API_KEY is not set. Please add it to .env.local');
        }
        groqClient = new Groq({ apiKey, dangerouslyAllowBrowser: true });
    }
    return groqClient;
}

async function chatCompletion(messages, temperature = 0.7) {
    const groq = getGroq();
    const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
    });
    return JSON.parse(response.choices[0].message.content);
}

async function chatCompletionText(messages, temperature = 0.7) {
    const groq = getGroq();
    const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature,
        max_tokens: 4096,
    });
    return response.choices[0].message.content;
}

// =============================================
// 1) Analyze JD + Resume
// =============================================
export async function analyzeJDAndResume(jd, resumeText) {
    const messages = [
        {
            role: 'system',
            content: `You are an expert HR analyst AI. Analyze the job description and candidate resume. Return a structured JSON analysis.
Output MUST be valid JSON with this exact structure:
{
  "job_title": "string",
  "required_skills": ["skill1", "skill2"],
  "candidate_skills": ["skill1", "skill2"],
  "skill_matches": ["skill1", "skill2"],
  "skill_gaps": ["skill1", "skill2"],
  "experience_level_required": "string",
  "candidate_experience_level": "string",
  "key_strengths": ["strength1"],
  "key_concerns": ["concern1"],
  "overall_match_score": 0-100,
  "interview_focus_areas": ["area1", "area2"]
}`
        },
        {
            role: 'user',
            content: `JOB DESCRIPTION:\n${jd}\n\nCANDIDATE RESUME:\n${resumeText}`
        }
    ];
    return await chatCompletion(messages, 0.3);
}

// =============================================
// 2) Generate Interview Question
// =============================================
export async function generateQuestion(context) {
    const { skillAnalysis, questions, answers, evaluations, maxQuestions = 6, customQuestions = [] } = context;

    let historyText = '';
    for (let i = 0; i < questions.length; i++) {
        historyText += `\nQ${i + 1}: ${questions[i]}`;
        if (answers[i]) historyText += `\nA${i + 1}: ${answers[i]}`;
        if (evaluations[i]) {
            historyText += `\nEval${i + 1}: Score=${evaluations[i].score}/10, Strengths=${(evaluations[i].strengths || []).join(', ')}, Weaknesses=${(evaluations[i].weaknesses || []).join(', ')}, Follow-up needed=${evaluations[i].follow_up_needed}`;
        }
    }

    const questionNumber = questions.length + 1;

    const messages = [
        {
            role: 'system',
            content: `You are a professional technical interviewer conducting a focused interview. Generate the next interview question.

Rules:
- This is question ${questionNumber} of a maximum ${maxQuestions} question interview.
- Keep questions concise and clear (1-3 sentences max).
- Questions should feel conversational and natural, as if a real interviewer is asking.
- Adapt based on previous answers:
  * Weak answer → probe deeper on that topic
  * Strong answer → increase difficulty
  * Skill gap found → target that gap
- For question 1: Start with a question about the candidate's strongest matching skill.
- For later questions: Use evaluation data to adapt.
- NEVER repeat a question that was already asked.

Return JSON: { "question": "your question text here", "target_skill": "skill being tested", "difficulty": "easy|medium|hard", "reasoning": "why this question" }`
        },
        {
            role: 'user',
            content: `SKILL ANALYSIS:\n${JSON.stringify(skillAnalysis, null, 2)}${customQuestions.length > 0 ? `\n\nCUSTOM QUESTIONS ALREADY ASKED (do NOT repeat these):\n${customQuestions.map((q, i) => `- ${q}`).join('\n')}` : ''}\n\nINTERVIEW HISTORY:${historyText || '\nNo questions asked yet - this is the first question.'}`
        }
    ];
    return await chatCompletion(messages, 0.7);
}

// =============================================
// 3) Evaluate Answer
// =============================================
export async function evaluateAnswer(question, answer, context) {
    const messages = [
        {
            role: 'system',
            content: `You are an expert technical interview evaluator. Evaluate the candidate's answer thoroughly and accurately.

Be precise and honest in your scoring. Do NOT inflate scores.
- Score 0-3: Poor, incorrect, or irrelevant
- Score 4-5: Below average, partially correct
- Score 6-7: Average, correct but lacks depth
- Score 8-9: Good, demonstrates strong understanding
- Score 10: Exceptional, expert-level answer

Return JSON with this EXACT structure:
{
  "score": 0-10,
  "technical_depth": 0-10,
  "clarity": 0-10,
  "relevance": 0-10,
  "confidence_estimate": 0-10,
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "follow_up_needed": true/false,
  "follow_up_reason": "reason why follow-up is needed or empty string",
  "detailed_feedback": "2-3 sentences of specific feedback"
}`
        },
        {
            role: 'user',
            content: `QUESTION: ${question}\n\nCANDIDATE'S ANSWER: ${answer}\n\nTARGET SKILL AREA: ${context.targetSkill || 'general'}\n\nJOB CONTEXT: ${context.jobTitle || 'Technical Role'}`
        }
    ];
    return await chatCompletion(messages, 0.2);
}

// =============================================
// 4) Generate Coding Problem
// =============================================
export async function generateCodingProblem(skillAnalysis) {
    const messages = [
        {
            role: 'system',
            content: `Generate a coding problem suitable for a 5-10 minute coding assessment. The problem should be:
- Clear and concise
- Solvable in 5-10 minutes
- Related to the candidate's skill area
- Include 2-3 test cases

Return JSON:
{
  "title": "Problem Title",
  "description": "Full problem description",
  "difficulty": "easy|medium",
  "test_cases": [{"input": "...", "expected_output": "..."}],
  "hints": ["hint1"],
  "expected_language": "javascript"
}`
        },
        {
            role: 'user',
            content: `Candidate skills: ${(skillAnalysis?.candidate_skills || []).join(', ')}\nJob focus: ${skillAnalysis?.job_title || 'Software Developer'}`
        }
    ];
    return await chatCompletion(messages, 0.6);
}

// =============================================
// 5) Evaluate Code
// =============================================
export async function evaluateCode(problem, code, language) {
    const messages = [
        {
            role: 'system',
            content: `Evaluate the submitted code solution accurately. Be thorough in your analysis.

Return JSON:
{
  "correctness": 0-10,
  "time_complexity_score": 0-10,
  "code_quality": 0-10,
  "edge_case_handling": 0-10,
  "overall_score": 0-10,
  "feedback": "detailed feedback",
  "identified_issues": ["issue1"],
  "suggested_improvements": ["improvement1"]
}`
        },
        {
            role: 'user',
            content: `PROBLEM:\n${JSON.stringify(problem)}\n\nSUBMITTED CODE (${language}):\n${code}`
        }
    ];
    return await chatCompletion(messages, 0.2);
}

// =============================================
// 6) Generate Final Report
// =============================================
export async function generateFinalReport(interviewData) {
    const {
        skillAnalysis,
        questions,
        answers,
        evaluations,
        violations,
        codingEvaluation,
        includeCodingRound,
    } = interviewData;

    let interviewTranscript = '';
    for (let i = 0; i < questions.length; i++) {
        interviewTranscript += `\n\n--- Question ${i + 1} ---`;
        interviewTranscript += `\nQ: ${questions[i]}`;
        interviewTranscript += `\nA: ${answers[i] || '[No response]'}`;
        if (evaluations[i]) {
            interviewTranscript += `\nScore: ${evaluations[i].score}/10`;
            interviewTranscript += `\nTechnical Depth: ${evaluations[i].technical_depth}/10`;
            interviewTranscript += `\nClarity: ${evaluations[i].clarity}/10`;
            interviewTranscript += `\nRelevance: ${evaluations[i].relevance}/10`;
            interviewTranscript += `\nStrengths: ${(evaluations[i].strengths || []).join(', ')}`;
            interviewTranscript += `\nWeaknesses: ${(evaluations[i].weaknesses || []).join(', ')}`;
        }
    }

    const messages = [
        {
            role: 'system',
            content: `You are a senior hiring manager generating a comprehensive and ACCURATE interview evaluation report. 

IMPORTANT: Be thorough, precise, and honest. Base all scores strictly on the actual interview data provided. Do NOT inflate or deflate scores.

Calculate the overall score as a weighted average:
- Interview performance (per-question scores): 70% weight
- Skill match from JD analysis: 20% weight  
- Violations impact: 10% negative weight (deduct for violations)
${includeCodingRound ? '- If coding round was included, factor it into 30% of interview performance.' : ''}

Return JSON:
{
  "overall_score": 0-100,
  "hire_recommendation": "Strong Yes | Yes | Maybe | No",
  "justification": "2-3 paragraphs of detailed justification",
  "risk_flags": ["flag1"],
  "top_strengths": ["strength1", "strength2", "strength3"],
  "major_concerns": ["concern1"],
  "suggested_next_round_focus": ["topic1"],
  "per_question_summary": [
    {
      "question": "q text",
      "answer_summary": "brief answer summary",
      "score": 0-10,
      "key_insight": "what this revealed about the candidate"
    }
  ],
  "skill_assessment": {
    "demonstrated_skills": ["skill1"],
    "unverified_skills": ["skill1"],
    "concerning_gaps": ["gap1"]
  },
  "violation_summary": {
    "total_violations": 0,
    "violation_types": ["type"],
    "impact_on_score": "none|minor|significant"
  },
  "interview_quality_notes": "any notes on interview quality"
}`
        },
        {
            role: 'user',
            content: `SKILL ANALYSIS:\n${JSON.stringify(skillAnalysis, null, 2)}\n\nINTERVIEW TRANSCRIPT:${interviewTranscript}\n\nVIOLATIONS: ${JSON.stringify(violations)}\n\nCODING EVALUATION: ${codingEvaluation ? JSON.stringify(codingEvaluation) : 'Not applicable - coding round was not included'}`
        }
    ];
    return await chatCompletion(messages, 0.2);
}
