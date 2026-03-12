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
// 0) Parse Job Description for Auto-Fill
// =============================================
export async function parseJobDescription(jdText) {
    const messages = [
        {
            role: 'system',
            content: `You are an expert HR analyst AI. Parse the given job description text and extract structured data to auto-fill a job posting form.

Output MUST be valid JSON with this exact structure:
{
  "title": "extracted job title",
  "employmentType": "Full-Time" or "Part-Time" or "Contract" or "Internship" or "Freelance",
  "locationType": "In Office" or "Remote" or "Hybrid",
  "location": "city, state/country",
  "department": "Engineering" or "Design" or "Marketing" or "Sales" or "Human Resources" or "Finance" or "Operations" or "Business Development" or "IT" or "Legal" or "Other" or "",
  "experienceLevel": "Entry Level" or "Junior" or "Mid-Level" or "Senior" or "Lead" or "Director" or "Executive",
  "experienceMin": number (minimum years),
  "experienceMax": number (maximum years),
  "description": "full job description text (clean and formatted)",
  "requirements": "extracted requirements section",
  "responsibilities": "extracted responsibilities section",
  "skills": ["skill1", "skill2", "skill3"],
  "mustHave": [
    "specific must-have qualification or requirement 1",
    "specific must-have qualification or requirement 2"
  ],
  "preferred": [
    "nice-to-have qualification 1",
    "nice-to-have qualification 2"
  ],
  "salaryMin": number or null,
  "salaryMax": number or null,
  "currency": "USD" or "INR" or "EUR" or "GBP"
}

Extract as much information as possible. For fields not found in the JD, use reasonable defaults. Skills should be specific technical/domain skills. Must-have criteria are essential qualifications; preferred are nice-to-have qualifications.`
        },
        {
            role: 'user',
            content: `JOB DESCRIPTION:\n${jdText}`
        }
    ];
    return await chatCompletion(messages, 0.3);
}

// =============================================
// 0.2) Generate Job Description from Prompt
// =============================================
export async function generateJobDescription(promptText) {
    const messages = [
        {
            role: 'system',
            content: `You are an expert HR analyst AI. Generate a professional and comprehensive job description based on the provided short prompt.
Output MUST be valid JSON with this exact structure:
{
  "title": "generated job title",
  "employmentType": "Full-Time" or "Part-Time" or "Contract" or "Internship" or "Freelance",
  "locationType": "In Office" or "Remote" or "Hybrid",
  "location": "city, state/country (infer or use generic if unavailable)",
  "department": "Engineering" or "Design" or "Marketing" or "Sales" or "Human Resources" or "Finance" or "Operations" or "Business Development" or "IT" or "Legal" or "Other",
  "experienceLevel": "Entry Level" or "Junior" or "Mid-Level" or "Senior" or "Lead" or "Director" or "Executive",
  "experienceMin": number (minimum years, infer from prompt or use 0),
  "experienceMax": number (maximum years, infer or use 2),
  "description": "A very detailed, professional, and well-written 2-3 paragraph job description.",
  "requirements": "A bulleted list or detailed paragraph of educational, functional, and general requirements.",
  "responsibilities": "A bulleted list of 5-8 daily responsibilities and tasks for the role.",
  "skills": ["skill1", "skill2", "skill3", "skill4", "skill5"],
  "mustHave": [
    "specific must-have qualification 1",
    "specific must-have qualification 2",
    "specific must-have qualification 3"
  ],
  "preferred": [
    "nice-to-have qualification 1",
    "nice-to-have qualification 2"
  ],
  "salaryMin": number or null,
  "salaryMax": number or null,
  "currency": "USD"
}

Fill in all details completely. Be robust and realistic for a modern hiring pipeline. Infer the most likely requirements, skills, and responsibilities for the job title requested in the prompt.`
        },
        {
            role: 'user',
            content: `USER PROMPT:\n${promptText}`
        }
    ];
    // Slightly higher temperature for generation vs parsing
    return await chatCompletion(messages, 0.6);
}

// =============================================
// 0.5) Extract Contact Info From Resume
// =============================================
export async function extractContactInfoFromResume(resumeText) {
    const messages = [
        {
            role: 'system',
            content: `You are an expert HR text extraction AI. Extract the candidate's name, email address, and phone number from the provided resume text.
Output MUST be valid JSON with this exact structure:
{
  "name": "full name or empty string if not found",
  "email": "primary email address or empty string",
  "phone": "primary phone number or empty string"
}`
        },
        {
            role: 'user',
            content: `RESUME TEXT:\n${resumeText.substring(0, 4000)}`
        }
    ];
    return await chatCompletion(messages, 0.1);
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
    const { skillAnalysis, questions, answers, evaluations, maxQuestions = 6, customQuestions = [], jobDescription = '' } = context;

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
- CRITICAL: Generate the question based STRICTLY on the Job Description (JD) provided. Ignore the candidate's personal background, specific projects not in the JD, or strengths/weaknesses from their resume.
- Focus on the skills and requirements listed in the JD.
- The candidate will be answering verbally in a live audio interview. Ensure the question is conversational, clear, and natural to speak.
- Adapt BASED ONLY on previous answers in this interview session:
  * Weak answer → probe deeper on that topic
  * Strong answer → increase difficulty within the scope of the JD
- NEVER repeat a question that was already asked.
- If the previous answer was vague or incomplete, you may set "is_follow_up" to true to ask a probing follow-up. Follow-ups do NOT count toward the question total.

Return JSON: { "question": "your question text here", "target_skill": "skill being tested", "difficulty": "easy|medium|hard", "reasoning": "why this question", "is_follow_up": false }`
        },
        {
            role: 'user',
            content: `JOB DESCRIPTION:\n${jobDescription}\n\nINTERVIEW HISTORY:${historyText || '\nNo questions asked yet - this is the first question.'}`
        }
    ];
    return await chatCompletion(messages, 0.7);
}

// =============================================
// 2b) Batch Generate Interview Questions (for HR preview)
// =============================================
export async function generateInterviewQuestions(jobDescription) {
    const messages = [
        {
            role: 'system',
            content: `You are a professional technical interviewer. Your task is to generate a comprehensive set of interview questions based ONLY on the provided job description.
CRITICAL: You must independently determine the ideal number of questions to ask (typically between 3 and 5 questions) to thoroughly assess all the core skills and requirements outlined in the JD.

Rules:
- Questions must be directly relevant to the job description and required skills.
- The candidate will be answering verbally in a live audio interview. Ensure the questions are conversational, clear, and natural to speak.
- Mix difficulty levels: start easy, then medium, then hard.
- Questions should be concise and clear (1-3 sentences).
- Include a mix of technical knowledge, problem-solving, and scenario-based questions.
- Each question should test a different skill area from the JD.

Return JSON: { "questions": [{ "question": "text", "target_skill": "skill being tested", "difficulty": "easy|medium|hard" }] }`
        },
        {
            role: 'user',
            content: `JOB DESCRIPTION:\n${jobDescription}\n\nAnalyze this JD and generate the necessary interview questions.`
        }
    ];
    return await chatCompletion(messages, 0.6);
}

// =============================================
// 3) Evaluate Answer
// =============================================
export async function evaluateAnswer(question, answer, context) {
    // If marked as not JD-relevant, skip grading
    if (context.isJDRelevant === false) {
        return {
            score: null,
            technical_depth: null,
            clarity: null,
            relevance: null,
            confidence_estimate: null,
            strengths: [],
            weaknesses: [],
            follow_up_needed: false,
            follow_up_reason: '',
            detailed_feedback: 'This question was not graded as it is not directly relevant to the job description.',
            graded: false,
        };
    }

    const expectedAnswerSection = context.expectedAnswer
        ? `\n\nEXPECTED ANSWER (provided by hiring manager — compare the candidate's answer against this):\n${context.expectedAnswer}`
        : '';

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
${context.expectedAnswer ? "\\nIMPORTANT: An expected answer has been provided by the hiring manager. Compare the candidate's answer against it. The closer the candidate's answer aligns with the expected answer (in substance, not necessarily wording), the higher the score should be." : ""}
${context.isCustomQuestion && !context.expectedAnswer ? `\nIMPORTANT: This is a manually added custom question, and no expected answer was provided.
Determine if the question is technical or non-technical (e.g., behavioral, HR, introductory).
If it is a NON-TECHNICAL question, you MUST set "graded" to false and "score" to null, because non-technical questions should not be graded.
If it is a TECHNICAL question, evaluate the technical accuracy relying on your own knowledge and set "graded" to true.` : ""}

IMPORTANT: If the question being evaluated is ALREADY a follow-up question, you MUST set "follow_up_needed" to false to prevent infinite follow-ups.

Return JSON with this EXACT structure (if graded is false, scores can be null):
{
  "score": 0-10, // or null if graded is false
  "graded": true/false, // set to false for non-technical custom queries lacking an expected answer
  "technical_depth": 0-10,
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
            content: `QUESTION: ${question}\n\nCANDIDATE'S ANSWER: ${answer}\n\nTARGET SKILL AREA: ${context.targetSkill || 'general'}\n\nJOB CONTEXT: ${context.jobTitle || 'Technical Role'}\n\nJOB DESCRIPTION: ${context.jobDescription || ''}${expectedAnswerSection}`
        }
    ];
    const result = await chatCompletion(messages, 0.2);
    return { graded: true, ...result };
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
    let gradedCount = 0;
    let gradedTotal = 0;
    for (let i = 0; i < questions.length; i++) {
        const isFollowUp = evaluations[i]?.isFollowUp || false;
        const isGraded = evaluations[i]?.graded !== false;
        interviewTranscript += `\n\n--- Question ${i + 1}${isFollowUp ? ' (Follow-up)' : ''}${!isGraded ? ' (Not Graded)' : ''} ---`;
        interviewTranscript += `\nQ: ${questions[i]}`;
        interviewTranscript += `\nA: ${answers[i] || '[No response]'}`;
        if (evaluations[i] && isGraded) {
            interviewTranscript += `\nScore: ${evaluations[i].score}/10`;
            interviewTranscript += `\nTechnical Depth: ${evaluations[i].technical_depth}/10`;
            interviewTranscript += `\nClarity: ${evaluations[i].clarity}/10`;
            interviewTranscript += `\nRelevance: ${evaluations[i].relevance}/10`;
            interviewTranscript += `\nStrengths: ${(evaluations[i].strengths || []).join(', ')}`;
            interviewTranscript += `\nWeaknesses: ${(evaluations[i].weaknesses || []).join(', ')}`;
            gradedCount++;
            gradedTotal += (evaluations[i].score || 0);
        } else if (!isGraded) {
            interviewTranscript += `\n[Not graded — non-technical or not relevant to JD]`;
        }
    }

    const messages = [
        {
            role: 'system',
            content: `You are a senior hiring manager generating a comprehensive and ACCURATE interview evaluation report. 

IMPORTANT: Be thorough, precise, and honest. Base all scores strictly on the actual interview data provided. Do NOT inflate or deflate scores.

IMPORTANT GRADING RULES:
- Only consider questions marked as "graded" for the overall score calculation.
- Questions marked "(Not Graded)" should be mentioned but NOT factored into the score.
- Follow-up questions provide additional insight but are supplementary.

Calculate the overall score as a weighted average:
- Interview performance (graded per-question scores only): 70% weight
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
      "key_insight": "what this revealed about the candidate",
      "graded": true,
      "is_follow_up": false
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
            content: `SKILL ANALYSIS:\n${JSON.stringify(skillAnalysis, null, 2)}\n\nGRADED QUESTIONS: ${gradedCount} (average: ${gradedCount > 0 ? (gradedTotal / gradedCount).toFixed(1) : 'N/A'}/10)\n\nINTERVIEW TRANSCRIPT:${interviewTranscript}\n\nVIOLATIONS: ${JSON.stringify(violations)}\n\nCODING EVALUATION: ${codingEvaluation ? JSON.stringify(codingEvaluation) : 'Not applicable - coding round was not included'}`
        }
    ];
    return await chatCompletion(messages, 0.2);
}
