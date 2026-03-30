'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DashboardProvider, useDashboard } from '@/context/DashboardContext';
import { getSupabase } from '@/lib/supabaseBrowser';
import styles from './dashboard.module.css';

const navItems = [
    { href: '/dashboard', icon: '📊', label: 'Dashboard' },
    { href: '/dashboard/jobs', icon: '💼', label: 'Jobs' },
    { href: '/dashboard/candidates', icon: '👥', label: 'Candidates' },
    { href: '/dashboard/settings', icon: '⚙️', label: 'Settings' },
];

function Sidebar() {
    const pathname = usePathname();
    const { state } = useDashboard();
    const user = state.user || {};
    const role = user.role || 'ADMIN';

    const isActive = (href) => {
        if (href === '/dashboard') return pathname === '/dashboard';
        return pathname.startsWith(href);
    };

    const filteredNavItems = navItems.filter(item => {
        if (role === 'CLIENT') {
            return !['/dashboard/settings', '/setup', '/dashboard/candidates'].includes(item.href);
        }
        return true;
    });

    const handleSignOut = async () => {
        const supabase = getSupabase();
        if (supabase) {
            await supabase.auth.signOut();
        }
        window.location.href = '/';
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
                {filteredNavItems.map(item => (
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

                <button onClick={handleSignOut} className={styles.navItem} style={{ border: 'none', background: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                    <span className={styles.navIcon}>🚪</span>
                    <span className={styles.navLabel}>Sign Out</span>
                </button>
            </nav>

            <div className={styles.sidebarFooter}>
                <div className={styles.userInfo}>
                    <div className={styles.userAvatar}>{user.name?.charAt(0) || 'HR'}</div>
                    <div className={styles.userText}>
                        <div className={styles.userName}>{user.name || 'HR Admin'}</div>
                        <div className={styles.userRole}>{user.designation || 'Administrator'}</div>
                    </div>
                </div>
            </div>
        </aside>
    );
}

function AuthGate({ children }) {
    const router = useRouter();
    const [checking, setChecking] = useState(true);
    const [authed, setAuthed] = useState(false);

    useEffect(() => {
        async function checkAuth() {
            const supabase = getSupabase();
            if (!supabase) {
                router.replace('/');
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.replace('/');
                return;
            }

            setAuthed(true);
            setChecking(false);
        }
        checkAuth();
    }, [router]);

    if (checking || !authed) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100vh', background: '#0a0a1a', color: '#888',
                fontFamily: 'Inter, sans-serif', fontSize: '0.95rem'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: 32, height: 32, border: '3px solid #333',
                        borderTopColor: '#e8604c', borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite', margin: '0 auto 16px'
                    }} />
                    Verifying session...
                </div>
            </div>
        );
    }

    return children;
}

export default function DashboardLayout({ children }) {
    return (
        <AuthGate>
            <DashboardProvider>
                <div className={styles.dashboardLayout}>
                    <Sidebar />
                    <main className={styles.mainContent}>
                        {children}
                    </main>
                </div>
            </DashboardProvider>
        </AuthGate>
    );
}
