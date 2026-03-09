'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DashboardProvider } from '@/context/DashboardContext';
import styles from './dashboard.module.css';

const navItems = [
    { href: '/dashboard', icon: '📊', label: 'Dashboard' },
    { href: '/dashboard/jobs', icon: '💼', label: 'Jobs' },
    { href: '/dashboard/candidates', icon: '👥', label: 'Candidates' },
    { href: '/setup', icon: '🤖', label: 'AI Interviews', external: true },
];

function Sidebar() {
    const pathname = usePathname();

    const isActive = (href) => {
        if (href === '/dashboard') return pathname === '/dashboard';
        return pathname.startsWith(href);
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
                <Link href="/dashboard" className={styles.sidebarLogo}>
                    <div className={styles.sidebarLogoIcon}>⚡</div>
                    <span>Hyper<span className={styles.sidebarLogoAccent}>Eval</span></span>
                </Link>
            </div>

            <nav className={styles.sidebarNav}>
                {navItems.map(item => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ''}`}
                    >
                        <span className={styles.navIcon}>{item.icon}</span>
                        <span className={styles.navLabel}>{item.label}</span>
                    </Link>
                ))}

                <div className={styles.sidebarDivider} />

                <Link href="/" className={styles.navItem}>
                    <span className={styles.navIcon}>🌐</span>
                    <span className={styles.navLabel}>View Career Page</span>
                </Link>
            </nav>

            <div className={styles.sidebarFooter}>
                <div className={styles.userInfo}>
                    <div className={styles.userAvatar}>HR</div>
                    <div>
                        <div className={styles.userName}>HR Admin</div>
                        <div className={styles.userRole}>Administrator</div>
                    </div>
                </div>
            </div>
        </aside>
    );
}

export default function DashboardLayout({ children }) {
    return (
        <DashboardProvider>
            <div className={styles.dashboardLayout}>
                <Sidebar />
                <main className={styles.mainContent}>
                    {children}
                </main>
            </div>
        </DashboardProvider>
    );
}
