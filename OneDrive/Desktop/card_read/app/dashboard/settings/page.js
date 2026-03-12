'use client';

import { useState, useEffect } from 'react';
import styles from './settings.module.css';
import { useDashboard } from '@/context/DashboardContext';

export default function SettingsPage() {
    const { state, updateUser } = useDashboard();
    const [isEditing, setIsEditing] = useState(false);
    const [profile, setProfile] = useState({
        name: '',
        email: '',
        designation: '',
        companyName: '',
        phone: '',
        role: ''
    });

    useEffect(() => {
        if (state.user) {
            setProfile(state.user);
        }
    }, [state.user]);

    const handleSave = () => {
        updateUser(profile);
        setIsEditing(false);
    };

    return (
        <div className={styles.settingsPage}>
            <header className={styles.header}>
                <h1 className={styles.title}>Settings</h1>
            </header>

            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Profile</h2>
                    {!isEditing ? (
                        <button className={styles.editBtn} onClick={() => setIsEditing(true)} title="Edit Profile">
                            ✏️
                        </button>
                    ) : (
                        <div className={styles.editActions}>
                            <button className={styles.cancelBtn} onClick={() => {
                                setProfile(state.user);
                                setIsEditing(false);
                            }}>Cancel</button>
                            <button className={styles.saveBtn} onClick={handleSave}>Save Changes</button>
                        </div>
                    )}
                </div>

                <div className={styles.profileCard}>
                    <div className={styles.grid}>
                        <div className={styles.field}>
                            <label className={styles.label}>Name</label>
                            {isEditing ? (
                                <input 
                                    className={styles.input} 
                                    value={profile.name} 
                                    onChange={e => setProfile({...profile, name: e.target.value})} 
                                />
                            ) : (
                                <div className={styles.value}>{profile.name}</div>
                            )}
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Email</label>
                            {isEditing ? (
                                <input 
                                    className={styles.input} 
                                    value={profile.email} 
                                    onChange={e => setProfile({...profile, email: e.target.value})} 
                                />
                            ) : (
                                <div className={styles.value}>{profile.email}</div>
                            )}
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Company Name</label>
                            {isEditing ? (
                                <input 
                                    className={styles.input} 
                                    value={profile.companyName} 
                                    onChange={e => setProfile({...profile, companyName: e.target.value})} 
                                />
                            ) : (
                                <div className={styles.value}>{profile.companyName}</div>
                            )}
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Designation</label>
                            {isEditing ? (
                                <input 
                                    className={styles.input} 
                                    value={profile.designation} 
                                    onChange={e => setProfile({...profile, designation: e.target.value})} 
                                />
                            ) : (
                                <div className={styles.value}>{profile.designation}</div>
                            )}
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Phone</label>
                            {isEditing ? (
                                <input 
                                    className={styles.input} 
                                    value={profile.phone} 
                                    placeholder="Enter phone number"
                                    onChange={e => setProfile({...profile, phone: e.target.value})} 
                                />
                            ) : (
                                <div className={styles.value}>{profile.phone || '—'}</div>
                            )}
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Role</label>
                            <div className={styles.roleValue}>{profile.role}</div>
                        </div>
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Integrations</h2>
                <div className={styles.integrationList}>
                    <button className={styles.integrationBtn}>
                        <span className={styles.btnIcon}>📅</span>
                        Connect Google Calendar
                    </button>
                    <button className={`${styles.integrationBtn} ${styles.btnDisabled}`} disabled>
                        <span className={styles.btnIcon}>📅</span>
                        Microsoft Calendar <span className={styles.comingSoon}>(Coming Soon)</span>
                    </button>
                </div>
            </section>
        </div>
    );
}
