'use client';

import Link from 'next/link';
import styles from './page.module.css';

export default function LandingPage() {
  return (
    <div className={styles.landing}>
      {/* Animated Background Orbs */}
      <div className={styles.bgOrbs}>
        <div className={`${styles.orb} ${styles.orb1}`} />
        <div className={`${styles.orb} ${styles.orb2}`} />
        <div className={`${styles.orb} ${styles.orb3}`} />
      </div>

      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>⚡</div>
          <span>Vision<span className={styles.logoGradient}>Hire</span> AI</span>
        </div>
        <div className={styles.navBadge}>✨ AI-Powered Interviews</div>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          <span>🔴</span> Live AI Interviewer
        </div>
        <h1 className={styles.heroTitle}>
          Hire Smarter with{' '}
          <span className={styles.heroGradient}>AI-Driven Interviews</span>
        </h1>
        <p className={styles.heroSub}>
          Conduct adaptive technical interviews with an AI avatar interviewer.
          Real-time speech analysis, intelligent proctoring, and structured hiring recommendations — all in under 8 minutes.
        </p>
        <div className={styles.heroCta}>
          <Link href="/setup" className="btn-primary">
            🚀 Start Interview
          </Link>
          <a href="#features" className="btn-secondary">
            Learn More ↓
          </a>
        </div>
      </section>

      {/* Stats */}
      <section className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statNumber}>5-8</div>
          <div className={styles.statLabel}>Minutes Per Interview</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNumber}>4-6</div>
          <div className={styles.statLabel}>Adaptive Questions</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNumber}>10+</div>
          <div className={styles.statLabel}>Evaluation Metrics</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNumber}>AI</div>
          <div className={styles.statLabel}>Powered Reports</div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className={styles.features}>
        <div className={styles.featuresTitle}>Platform Features</div>
        <div className={styles.featuresGrid}>
          <div className={`glass-card ${styles.featureCard}`}>
            <div className={styles.featureIcon}>🤖</div>
            <h3>AI Avatar Interviewer</h3>
            <p>A lifelike AI avatar speaks each question aloud, creating a natural and conversational interview experience.</p>
          </div>
          <div className={`glass-card ${styles.featureCard}`}>
            <div className={styles.featureIcon}>🎯</div>
            <h3>Adaptive Questions</h3>
            <p>Questions dynamically adapt based on JD requirements, resume strengths, skill gaps, and previous answer quality.</p>
          </div>
          <div className={`glass-card ${styles.featureCard}`}>
            <div className={styles.featureIcon}>🛡️</div>
            <h3>Smart Proctoring</h3>
            <p>Lightweight camera-based face detection and tab-switch monitoring ensures interview integrity without being invasive.</p>
          </div>
          <div className={`glass-card ${styles.featureCard}`}>
            <div className={styles.featureIcon}>📊</div>
            <h3>Detailed Analytics</h3>
            <p>Per-question scoring, skill gap radar charts, violation logs, and a structured hiring recommendation report.</p>
          </div>
          <div className={`glass-card ${styles.featureCard}`}>
            <div className={styles.featureIcon}>💻</div>
            <h3>Optional Coding Round</h3>
            <p>Integrated code editor with copy-paste detection and AI-powered code evaluation for technical assessment.</p>
          </div>
          <div className={`glass-card ${styles.featureCard}`}>
            <div className={styles.featureIcon}>🎙️</div>
            <h3>Voice Recognition</h3>
            <p>Real-time speech-to-text captures candidate responses, generating accurate transcripts for evaluation.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>© 2026 VisionHire AI — Built with intelligence. Powered by AI.</p>
      </footer>
    </div>
  );
}
