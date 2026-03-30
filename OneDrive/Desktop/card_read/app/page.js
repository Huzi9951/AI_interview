'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseBrowser';
import styles from './page.module.css';

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password.');
      setLoading(false);
      return;
    }

    const supabase = getSupabase();

    if (!supabase) {
      setError('Authentication service is not configured. Please contact the administrator.');
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/dashboard');
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        if (data.user && data.session === null) {
          setError('Account created! Please check your email for a confirmation link before signing in.');
          setIsLogin(true);
        } else {
          router.push('/dashboard');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
          <span>Hyper<span className={styles.logoGradient}>Eval</span></span>
        </div>
      </nav>

      <div className={styles.authContainer}>
        <div className={`glass-card ${styles.authCard}`}>
          <h2 className={styles.authTitle}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className={styles.authSubtitle}>
            {isLogin
              ? 'Enter your credentials to access the dashboard'
              : 'Sign up to start evaluating candidates with AI'}
          </p>

          {error && <div className={styles.authError}>{error}</div>}

          <form onSubmit={handleSubmit} className={styles.authForm}>
            <div className={styles.inputGroup}>
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="form-input"
                required
              />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="form-input"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              className={`btn-primary ${styles.authSubmit}`}
              disabled={loading}
            >
              {loading
                ? 'Please wait...'
                : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className={styles.authToggle}>
            <p>
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className={styles.toggleBtn}
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>© 2026 HyperEval — Built with intelligence. Powered by AI.</p>
      </footer>
    </div>
  );
}
