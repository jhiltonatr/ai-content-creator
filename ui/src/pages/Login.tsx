import { useEffect, useState, type FormEvent } from 'react';
import { api, setAuthToken } from '../api/client';

export default function Login({ onAuthed }: { onAuthed: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice] = useState(() => sessionStorage.getItem('storyforge.pwchanged') === '1');

  useEffect(() => {
    sessionStorage.removeItem('storyforge.pwchanged');
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.login(email.trim(), password);
      setAuthToken(res.token);
      onAuthed();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={submit}>
        <span className="brand login-brand">
          <img className="brand-icon" src="/app-icon.svg" width="22" height="22" alt="" />
          Storyforge
        </span>
        <p className="muted small">Sign in to your account</p>
        {notice && <div className="banner ok">Password changed. Please sign in with your new password.</div>}
        {error && <div className="banner error">{error}</div>}
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <button className="primary" disabled={busy || !email.trim() || !password} type="submit">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted small login-hint">
          Demo account: <code>alice@example.com</code> / <code>storyforge</code>
        </p>
      </form>
    </div>
  );
}