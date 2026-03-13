'use client';

import { useState, useEffect } from 'react';
import styles from './settings.module.css';
import { useDashboard } from '@/context/DashboardContext';
import { supabase } from '@/lib/supabaseClient';


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

    const [inviteName, setInviteName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('TEAM_MEMBER'); // TEAM_MEMBER | CLIENT
    const [selectedJobs, setSelectedJobs] = useState([]);
    const [isInviting, setIsInviting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [members, setMembers] = useState([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);
    const [toast, setToast] = useState('');

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

    useEffect(() => {
        if (state.user) {
            setProfile(state.user);
        }
        fetchMembers();
    }, [state.user]);

    const fetchMembers = async () => {
        setIsLoadingMembers(true);
        try {
            const res = await fetch('/api/invite-member');
            const data = await res.json();
            if (data.success) {
                setMembers(data.members || []);
            }
        } catch (err) {
            console.error('Failed to fetch members:', err);
        } finally {
            setIsLoadingMembers(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateUser(profile);
            showToast('✓ Profile updated successfully');
            setIsEditing(false);
        } catch (err) {
            showToast('⚠ Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    const handleInvite = async () => {
        if (!inviteEmail) {
            showToast('⚠ Please enter an email address.');
            return;
        }
        if (inviteRole === 'CLIENT' && selectedJobs.length === 0) {
            showToast('⚠ Please select at least one job for the client.');
            return;
        }

        setIsInviting(true);
        try {
            const res = await fetch('/api/invite-member', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: inviteName,
                    email: inviteEmail,
                    role: inviteRole,
                    jobIds: selectedJobs,
                    companyName: profile.companyName || 'HyperEval'
                })
            });

            const data = await res.json();
            if (data.success) {
                showToast(`✓ Invitation sent to ${inviteEmail}`);
                setInviteEmail('');
                setInviteName('');
                setSelectedJobs([]);
                fetchMembers(); // Refresh the list
            } else {
                showToast(`⚠ ${data.error || 'Failed to send invitation'}`);
            }
        } catch (err) {
            showToast(`⚠ Error: ${err.message}`);
        } finally {
            setIsInviting(false);
        }
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
                            <button className={styles.saveBtn} onClick={handleSave} disabled={isSaving}>
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
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
                <h2 className={styles.sectionTitle}>Invite Team & Clients</h2>
                <div className={styles.inviteCard}>
                    <p className={styles.inviteDesc}>
                        Invite team members to manage your pipeline or clients to review specific jobs. 
                        They will receive an email with their login credentials.
                    </p>
                    
                    <div className={styles.inviteForm}>
                        <div className={styles.inviteGroup}>
                            <label className={styles.label}>Full Name</label>
                            <input 
                                type="text" 
                                className={styles.inviteInput} 
                                placeholder="John Doe"
                                value={inviteName}
                                onChange={(e) => setInviteName(e.target.value)}
                            />
                        </div>

                        <div className={styles.inviteGroup}>
                            <label className={styles.label}>Email Address</label>
                            <input 
                                type="email" 
                                className={styles.inviteInput} 
                                placeholder="name@company.com"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                            />
                        </div>

                        <div className={styles.inviteGroup}>
                            <label className={styles.label}>Role</label>
                            <div className={styles.roleSelector}>
                                <button 
                                    className={`${styles.roleBtn} ${inviteRole === 'TEAM_MEMBER' ? styles.roleBtnActive : ''}`}
                                    onClick={() => setInviteRole('TEAM_MEMBER')}
                                >
                                    Employee
                                </button>
                                <button 
                                    className={`${styles.roleBtn} ${inviteRole === 'CLIENT' ? styles.roleBtnActive : ''}`}
                                    onClick={() => setInviteRole('CLIENT')}
                                >
                                    Partner
                                </button>
                            </div>
                        </div>

                        {inviteRole === 'CLIENT' && (
                            <div className={styles.inviteGroup}>
                                <label className={styles.label}>Assigned Jobs</label>
                                <div className={styles.jobList}>
                                    {state.jobs.map(job => (
                                        <label key={job.id} className={styles.jobOption}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedJobs.includes(job.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedJobs([...selectedJobs, job.id]);
                                                    } else {
                                                        setSelectedJobs(selectedJobs.filter(id => id !== job.id));
                                                    }
                                                }}
                                            />
                                            <span className={styles.jobName}>{job.title}</span>
                                        </label>
                                    ))}
                                    {state.jobs.length === 0 && (
                                        <div className={styles.noJobs}>No jobs found. Create some jobs first.</div>
                                    )}
                                </div>
                            </div>
                        )}

                        <button 
                            className={styles.inviteSubmitBtn} 
                            onClick={handleInvite}
                            disabled={isInviting}
                        >
                            {isInviting ? 'Sending...' : 'Send Invitation'}
                        </button>
                    </div>

                    <div className={styles.memberListSection}>
                        <h3 className={styles.listTitle}>Invited Members</h3>
                        {isLoadingMembers ? (
                            <div className={styles.loading}>Loading members...</div>
                        ) : members.length === 0 ? (
                            <div className={styles.emptyList}>No one invited yet.</div>
                        ) : (
                            <div className={styles.tableWrapper}>
                                <table className={styles.memberTable}>
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Role</th>
                                            <th>Invited At</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {members.map(member => (
                                            <tr key={member.id}>
                                                <td className={styles.memberName}>{member.name || '—'}</td>
                                                <td className={styles.memberEmail}>{member.email}</td>
                                                <td>
                                                    <span className={`${styles.roleBadge} ${styles[member.role.toLowerCase()]}`}>
                                                        {member.role === 'TEAM_MEMBER' ? 'Employee' : 'Partner'}
                                                    </span>
                                                </td>
                                                <td className={styles.memberDate}>
                                                    {new Date(member.invited_at).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </section>
            {toast && <div className={styles.toast}>{toast}</div>}

        </div>
    );
}
