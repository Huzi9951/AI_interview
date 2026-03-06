'use client';

import { useDashboard } from '@/context/DashboardContext';
import Link from 'next/link';
import styles from './dashboard.module.css';

export default function DashboardPage() {
    const { state, getStats } = useDashboard();
    const stats = getStats();

    const openJobsList = state.jobs
        .filter(j => j.status === 'open')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 3);

    const awaitingReview = state.candidates.filter(c => {
        if (!c.jobAssignments || c.jobAssignments.length === 0) {
            return ['completed', 'interviewed'].includes(c.interviewStatus);
        }
        const status = c.jobAssignments[0].status;
        return status === 'completed' || status === 'interviewed';
    });

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
                    <Link href="/dashboard/candidates" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div className={styles.statCard}>
                            <div className={`${styles.statIcon} ${styles.statIconBlue}`}>👥</div>
                            <div className={styles.statInfo}>
                                <div className={styles.statBadge + ' ' + styles.statBadgeGreen}>Growing</div>
                                <div className={styles.statLabel}>Total Applicants</div>
                                <div className={styles.statValue}>{stats.totalApplicants}</div>
                                <div className={styles.statMeta}>in your talent pool</div>
                            </div>
                        </div>
                    </Link>

                    <Link href="/dashboard/jobs" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div className={styles.statCard}>
                            <div className={`${styles.statIcon} ${styles.statIconGreen}`}>🏢</div>
                            <div className={styles.statInfo}>
                                <div className={styles.statBadge + ' ' + styles.statBadgeBlue}>Recruiting</div>
                                <div className={styles.statLabel}>Open Jobs</div>
                                <div className={styles.statValue}>{stats.openJobs}</div>
                                <div className={styles.statMeta}>actively hiring</div>
                            </div>
                        </div>
                    </Link>

                    <Link href="/dashboard/candidates" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div className={styles.statCard}>
                            <div className={`${styles.statIcon} ${styles.statIconOrange}`}>👤</div>
                            <div className={styles.statInfo}>
                                <div className={styles.statBadge + ' ' + styles.statBadgeOrange}>Processing</div>
                                <div className={styles.statLabel}>Total Candidates</div>
                                <div className={styles.statValue}>{stats.totalCandidates}</div>
                                <div className={styles.statMeta}>in the pipeline</div>
                            </div>
                        </div>
                    </Link>

                    <Link href="/dashboard/candidates" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div className={styles.statCard}>
                            <div className={`${styles.statIcon} ${styles.statIconPurple}`}>🤖</div>
                            <div className={styles.statInfo}>
                                <div className={styles.statBadge + ' ' + styles.statBadgePurple}>Tracking</div>
                                <div className={styles.statLabel}>Total AI Interview Count</div>
                                <div className={styles.statValue}>{stats.interviewCount}</div>
                                <div className={styles.statMeta}>completed interviews</div>
                            </div>
                        </div>
                    </Link>
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
                        {/* Open Jobs List (Replaced Notifications) */}
                        <div className={styles.notifCard} style={{ paddingBottom: '8px' }}>
                            <div className={styles.notifHeader} style={{ marginBottom: 16 }}>
                                <span className={styles.notifBellIcon}>🏢</span>
                                <h3 className={styles.notifTitle}>Latest Open Jobs</h3>
                            </div>

                            {openJobsList.length > 0 ? (
                                <div className={styles.recentJobsContainer}>
                                    {openJobsList.map(job => (
                                        <div key={job.id} className={styles.recentJobRow}>
                                            <div className={styles.recentJobIcon}>💼</div>
                                            <div className={styles.recentJobDetails}>
                                                <div className={styles.recentJobTitle}>{job.title}</div>
                                                <div className={styles.recentJobMeta}>
                                                    {job.location} • {job.applicantCount || 0} applicants
                                                </div>
                                            </div>
                                            <Link href={`/dashboard/jobs`} className={styles.recentJobLink}>
                                                View
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className={styles.notifEmpty}>
                                    <div className={styles.notifBell}>📭</div>
                                    <div className={styles.notifEmptyText}>No open jobs currently.</div>
                                </div>
                            )}
                        </div>

                        {/* Review Card */}
                        <div className={styles.reviewCard}>
                            <div className={styles.reviewHeader}>
                                <div className={styles.reviewDot} style={awaitingReview.length > 0 ? { background: '#f59e0b' } : { background: '#d1d5db' }} />
                                <h3 className={styles.reviewTitle}>
                                    {awaitingReview.length > 0 ? `${awaitingReview.length} applicants awaiting review` : `No applicants awaiting review`}
                                </h3>
                            </div>

                            {awaitingReview.length > 0 ? (
                                <div className={styles.recentJobsContainer} style={{ marginTop: 12 }}>
                                    {awaitingReview.slice(0, 3).map(c => (
                                        <div key={c.id} className={styles.recentJobRow}>
                                            <div className={styles.recentJobIcon} style={{ background: '#fef3e2', color: '#f59e0b' }}>👤</div>
                                            <div className={styles.recentJobDetails}>
                                                <div className={styles.recentJobTitle}>{c.name || c.email}</div>
                                                <div className={styles.recentJobMeta}>
                                                    {c.jobAssignments?.[0]?.jobTitle || 'Assigned Candidate'}
                                                </div>
                                            </div>
                                            <Link href={`/dashboard/candidates/report?email=${encodeURIComponent(c.email)}`} className={styles.recentJobLink} style={{ background: '#fef3e2', color: '#f59e0b' }}>
                                                Review
                                            </Link>
                                        </div>
                                    ))}
                                    {awaitingReview.length > 3 && (
                                        <Link href="/dashboard/candidates" style={{ display: 'block', textAlign: 'center', fontSize: '0.8rem', color: '#6b7280', marginTop: 8, textDecoration: 'none' }}>
                                            View {awaitingReview.length - 3} more...
                                        </Link>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div className={styles.reviewDesc}>
                                        No new applicants to review
                                    </div>
                                    <div className={styles.reviewTime}>Updated just now</div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
