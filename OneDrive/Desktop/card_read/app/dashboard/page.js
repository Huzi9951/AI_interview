'use client';

import { useDashboard } from '@/context/DashboardContext';
import Link from 'next/link';
import styles from './dashboard.module.css';

export default function DashboardPage() {
    const { getStats } = useDashboard();
    const stats = getStats();

    return (
        <>
            <div className={styles.topBar}>
                <h1 className={styles.topBarTitle}>Dashboard</h1>
                <div className={styles.topBarActions}>
                    <button className={styles.topBarBtn}>📈 Analytics</button>
                    <Link href="/" className={styles.topBarBtn}>🌐 View Career Page</Link>
                </div>
            </div>

            <div className={styles.pageContent}>
                {/* Stats */}
                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <div className={`${styles.statIcon} ${styles.statIconBlue}`}>👥</div>
                        <div className={styles.statInfo}>
                            <div className={styles.statBadge + ' ' + styles.statBadgeGreen}>Growing</div>
                            <div className={styles.statLabel}>Total Applicants</div>
                            <div className={styles.statValue}>{stats.totalApplicants}</div>
                            <div className={styles.statMeta}>in your talent pool</div>
                        </div>
                    </div>

                    <div className={styles.statCard}>
                        <div className={`${styles.statIcon} ${styles.statIconGreen}`}>🏢</div>
                        <div className={styles.statInfo}>
                            <div className={styles.statBadge + ' ' + styles.statBadgeBlue}>Recruiting</div>
                            <div className={styles.statLabel}>Open Jobs</div>
                            <div className={styles.statValue}>{stats.openJobs}</div>
                            <div className={styles.statMeta}>actively hiring</div>
                        </div>
                    </div>

                    <div className={styles.statCard}>
                        <div className={`${styles.statIcon} ${styles.statIconOrange}`}>👤</div>
                        <div className={styles.statInfo}>
                            <div className={styles.statBadge + ' ' + styles.statBadgeOrange}>Processing</div>
                            <div className={styles.statLabel}>Total Candidates</div>
                            <div className={styles.statValue}>{stats.totalCandidates}</div>
                            <div className={styles.statMeta}>in the pipeline</div>
                        </div>
                    </div>

                    <div className={styles.statCard}>
                        <div className={`${styles.statIcon} ${styles.statIconPurple}`}>🤖</div>
                        <div className={styles.statInfo}>
                            <div className={styles.statBadge + ' ' + styles.statBadgePurple}>Tracking</div>
                            <div className={styles.statLabel}>Total AI Interview Count</div>
                            <div className={styles.statValue}>{stats.interviewCount}</div>
                            <div className={styles.statMeta}>completed interviews</div>
                        </div>
                    </div>
                </div>

                {/* Content Grid */}
                <div className={styles.contentGrid}>
                    {/* Process Steps */}
                    <div className={styles.processCard}>
                        <h2 className={styles.processTitle}>
                            Follow these steps to streamline your hiring process:
                        </h2>
                        <div className={styles.processSteps}>
                            <div className={styles.processStep}>
                                <div className={`${styles.processStepIcon} ${styles.processStepIconCreate}`}>
                                    ⚙️
                                </div>
                                <div className={styles.processConnector} />
                                <div className={styles.processStepTitle}>Create & Publish Jobs</div>
                                <div className={styles.processStepDesc}>
                                    Create job postings and publish them to start attracting candidates.
                                </div>
                                <div className={styles.processTags}>
                                    <span className={styles.processTag}>#Posting</span>
                                    <span className={styles.processTag}>#Publish</span>
                                </div>
                            </div>

                            <div className={styles.processStep}>
                                <div className={`${styles.processStepIcon} ${styles.processStepIconSync}`}>
                                    📤
                                </div>
                                <div className={styles.processConnector} />
                                <div className={styles.processStepTitle}>Sync Applicants</div>
                                <div className={styles.processStepDesc}>
                                    Import or sync candidate data from your ATS to build your talent pool.
                                </div>
                                <div className={styles.processTags}>
                                    <span className={styles.processTag}>#Pdf</span>
                                    <span className={styles.processTag}>#Csv</span>
                                </div>
                            </div>

                            <div className={styles.processStep}>
                                <div className={`${styles.processStepIcon} ${styles.processStepIconInterview}`}>
                                    🤖
                                </div>
                                <div className={styles.processStepTitle}>AI Interviews</div>
                                <div className={styles.processStepDesc}>
                                    Invite candidates to complete AI-powered interviews for initial screening.
                                </div>
                                <div className={styles.processTags}>
                                    <span className={styles.processTag}>#Screening</span>
                                    <span className={styles.processTag}>#AI</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div>
                        {/* Notifications */}
                        <div className={styles.notifCard}>
                            <div className={styles.notifHeader}>
                                <span className={styles.notifBellIcon}>🔔</span>
                                <h3 className={styles.notifTitle}>Notifications</h3>
                            </div>

                            <div className={styles.notifTabs}>
                                <button className={`${styles.notifTab} ${styles.notifTabActive}`}>
                                    📋 Interviews (0)
                                </button>
                                <button className={styles.notifTab}>
                                    💬 Mentions (0)
                                </button>
                            </div>

                            <div className={styles.notifEmpty}>
                                <div className={styles.notifBell}>🔔</div>
                                <div className={styles.notifEmptyText}>No new notifications.</div>
                            </div>
                        </div>

                        {/* Review Card */}
                        <div className={styles.reviewCard}>
                            <div className={styles.reviewHeader}>
                                <div className={styles.reviewDot} />
                                <h3 className={styles.reviewTitle}>No applicants awaiting review</h3>
                            </div>
                            <div className={styles.reviewDesc}>
                                No new applicants in the last 3 days
                            </div>
                            <div className={styles.reviewTime}>Updated just now</div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
