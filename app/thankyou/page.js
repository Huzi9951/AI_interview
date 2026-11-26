'use client';

import styles from './thankyou.module.css';

export default function ThankYouPage() {
    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.icon}>🎉</div>
                <h1 className={styles.title}>Thank You!</h1>
                <p className={styles.subtitle}>
                    Your interview has been successfully completed and recorded.
                    Our team will review your responses and get back to you soon.
                </p>

                <div className={styles.nextSteps}>
                    <h3 className={styles.nextStepsTitle}>What happens next?</h3>
                    <ul className={styles.nextStepsList}>
                        <li>Our hiring team will review your interview recording and responses</li>
                        <li>You will receive an email with the next steps within a few business days</li>
                        <li>If selected, you may be invited for a follow-up round</li>
                    </ul>
                </div>

                <div className={styles.tip}>
                    💡 <strong>Tip:</strong> If you have any questions about the process, feel free to reach out to the recruiter who sent you the invitation.
                </div>

                <p className={styles.footer}>
                    Powered by <strong>HyperEval</strong> • AI-Driven Hiring Platform
                </p>
            </div>
        </div>
    );
}
