<p align="center">✦ &nbsp; HUZI9951 &nbsp; ✦</p>

# HyperEval

Interview app for a hiring loop. A recruiter adds a job description and a resume. The app asks follow-up questions out loud, can run a coding round, watches for tab switches, and writes a report with a skill chart.

## Stack

- Next.js App Router and React
- Groq (Llama) through `lib/groqService.js` and `/api/ai`
- Browser speech synthesis and speech recognition
- Monaco editor for the coding round
- Chart.js for the report
- Supabase for accounts and saved interviews
- Playwright for the end-to-end tests

## Run

Node.js, then a Groq key:

```bash
git clone https://github.com/Huzi9951/AI_interview.git
cd AI_interview
npm install
```

Create `.env.local` in this folder:

```env
NEXT_PUBLIC_GROQ_API_KEY=your_groq_api_key_here
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm run test:e2e` runs the Playwright suite.

## Flow

1. Upload a job description and a resume PDF.
2. The model lists skills, matches, and gaps.
3. The candidate answers spoken questions. Later questions follow the previous answer.
4. The session notes tab switches.
5. An optional coding task opens in the editor and is scored.
6. The report shows strengths, gaps, and a hiring recommendation.
