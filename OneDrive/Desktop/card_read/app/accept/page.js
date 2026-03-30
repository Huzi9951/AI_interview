'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './page.module.css';

function AcceptContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [tokenData, setTokenData] = useState(null);
    const [error, setError] = useState('');
    const [expired, setExpired] = useState(false);
    const [accepting, setAccepting] = useState(false);
    const [alreadyDone, setAlreadyDone] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        async function init() {
            const token = searchParams.get('token');
            if (!token) {
                setError('No invitation token found. Please check your invite link.');
                setChecking(false);
                return;
            }

            try {
                // Verify token server-side (HMAC signature check)
                const res = await fetch('/api/verify-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });
                const result = await res.json();

                if (!res.ok) {
                    if (result.expired) {
                        setExpired(true);
                    } else {
                        setError(result.error || 'Invalid invitation token. Please contact the recruiter.');
                    }
                    setChecking(false);
                    return;
                }

                setTokenData(result.data);

                if (result.alreadyDone) {
                    setAlreadyDone(true);
                    setChecking(false);
                    return;
                }

                setChecking(false);
            } catch (e) {
                setError('Failed to verify invitation. Please try again later.');
                setChecking(false);
            }
        }
        init();
    }, [searchParams]);

    const handleAccept = () => {
        if (!tokenData) return;
        setAccepting(true);

        const token = searchParams.get('token');
        router.push(`/interview?token=${encodeURIComponent(token)}`);
    };

    const formatExpiry = () => {
        if (!tokenData?.expiresAt) return '';
        const remaining = tokenData.expiresAt - Date.now();
        if (remaining <= 0) return 'Expired';
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        if (hours > 24) return `${Math.floor(hours / 24)} days, ${hours % 24} hours remaining`;
        if (hours > 0) return `${hours} hours, ${minutes} minutes remaining`;
        return `${minutes} minutes remaining`;
    };

    if (checking) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.loadingSpinner} />
                    <p className={styles.loadingText}>Verifying invitation...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.errorIcon}>⚠️</div>
                    <h1 className={styles.errorTitle}>Invalid Invitation</h1>
                    <p className={styles.errorDesc}>{error}</p>
                </div>
            </div>
        );
    }

    if (alreadyDone) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.errorIcon}>✅</div>
                    <h1 className={styles.errorTitle}>Interview Already Completed</h1>
                    <p className={styles.errorDesc}>
                        You have already completed this interview. Each interview can only be taken once.
                        If you believe this is an error, please contact the recruiter.
                    </p>
                    {tokenData?.jobTitle && (
                        <p className={styles.expiredJob}>Position: <strong>{tokenData.jobTitle}</strong></p>
                    )}
                </div>
            </div>
        );
    }

    if (expired) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.errorIcon}>⏰</div>
                    <h1 className={styles.errorTitle}>Invitation Expired</h1>
                    <p className={styles.errorDesc}>
                        This interview invitation has expired. Please contact the recruiter to request a new invite.
                    </p>
                    {tokenData?.jobTitle && (
                        <p className={styles.expiredJob}>Position: <strong>{tokenData.jobTitle}</strong></p>
                    )}
                </div>
            </div>
        );
    }

    if (!tokenData) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.loadingSpinner} />
                    <p className={styles.loadingText}>Loading invitation...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.logo}>
                    <span className={styles.logoDot} />
                    <span className={styles.logoText}>Hyper<span className={styles.logoHighlight}>Eval</span></span>
                </div>

                <h1 className={styles.title}>Interview Invitation</h1>
                <p className={styles.subtitle}>You have been invited to take an AI-powered interview</p>

                <div className={styles.jobCard}>
                    <div className={styles.jobLabel}>Position</div>
                    <div className={styles.jobTitle}>{tokenData.jobTitle}</div>
                </div>

                {tokenData.name && (
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Candidate</span>
                        <span className={styles.infoValue}>{tokenData.name}</span>
                    </div>
                )}

                <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Email</span>
                    <span className={styles.infoValue}>{tokenData.email}</span>
                </div>

                <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Expires</span>
                    <span className={styles.infoValue}>{formatExpiry()}</span>
                </div>

                <div className={styles.instructions}>
                    <h3>Before you begin:</h3>
                    <ul>
                        <li>Use <strong>Microsoft Edge</strong> or <strong>Google Chrome</strong> for the best experience</li>
                        <li>Ensure you are in a quiet environment</li>
                        <li>Allow camera, microphone, and screen sharing when prompted</li>
                        <li>The interview will take approximately 15-30 minutes</li>
                        <li>⚠️ You can only take this interview <strong>once</strong></li>
                    </ul>
                </div>

                <button
                    className={styles.acceptBtn}
                    onClick={handleAccept}
                    disabled={accepting}
                >
                    {accepting ? 'Redirecting...' : '✓ Accept & Start Interview'}
                </button>
            </div>
        </div>
    );
}

export default function AcceptPage() {
    return (
        <Suspense fallback={
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.loadingSpinner} />
                    <p className={styles.loadingText}>Loading...</p>
                </div>
            </div>
        }>
            <AcceptContent />
        </Suspense>
    );
}
