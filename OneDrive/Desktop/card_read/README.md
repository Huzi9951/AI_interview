# VisionHire AI - Intelligent Interview Platform

VisionHire AI is a state-of-the-art, AI-powered interview platform designed to conduct adaptive technical interviews using an AI avatar. It streamlines the hiring process by providing real-time speech analysis, intelligent proctoring, and comprehensive evaluation reports.

## 🚀 Features

- **🤖 AI Avatar Interviewer**: A lifelike AI avatar that speaks questions aloud, providing a natural and engaging interview experience.
- **🎯 Adaptive Questioning**: Questions dynamically adapt based on the Job Description (JD), the candidate's resume, skill gaps, and the quality of previous answers.
- **🎙️ Real-time Speech-to-Text**: Captures and transcribes candidate responses instantly for analysis.
- **🛡️ Smart Proctoring**: Monitors tab switches and window focus to ensure interview integrity.
- **💻 Integrated Coding Round**: An optional coding challenge with an embedded editor and AI-powered code evaluation.
- **📊 Comprehensive Reports**: Detailed feedback, skill gap analysis (radar charts), and structured hiring recommendations.

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **AI Engine**: [Groq SDK](https://github.com/groq/groq-sdk-nodejs) (Llama 3.3 70B)
- **Styling**: Vanilla CSS with modern aesthetics (glassmorphism, animations)
- **Components**: React, Chart.js for data visualization
- **Editor**: Monaco Editor for the coding round

## 📋 Getting Started

### Prerequisites

- Node.js installed
- A Groq API Key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Huzi9951/AI_interview.git
   cd AI_interview
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the root directory and add:
   ```env
   NEXT_PUBLIC_GROQ_API_KEY=your_groq_api_key_here
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 💡 How It Works

1. **Setup**: The recruiter uploads a Job Description (JD) and a candidate's Resume (PDF).
2. **Analysis**: VisionHire AI analyzes the JD and Resume to identify key skills, matches, and gaps.
3. **Interview**: The candidate undergoes an automated interview where the AI avatar asks adaptive questions based on the analysis.
4. **Proctoring**: The system monitors for potential violations (like switching tabs) during the session.
5. **Coding Round (Optional)**: Candidates may be presented with a coding challenge tailored to their skill set.
6. **Reporting**: After the interview, a detailed report is generated with scores, strengths, weaknesses, and a final hiring recommendation.

---
Built with intelligence. Powered by AI.
