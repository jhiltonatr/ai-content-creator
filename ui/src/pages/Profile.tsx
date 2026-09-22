import { useEffect, useState, type FormEvent } from 'react';
import { api, setAuthToken } from '../api/client';
import type { Me } from '../api/types';

interface Props {
  me: Me | null;
  onProfileUpdated: () => void;
}

export default function Profile({ me, onProfileUpdated }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    setDisplayName(me?.user.displayName ?? '');
    setEmail(me?.user.email ?? '');
  }, [me]);

  const submitProfile = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.updateProfile({ email: email.trim(), displayName: displayName.trim() });
      setSaved(true);
      onProfileUpdated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (newPassword !== confirm) {
      setPwError('New password and confirmation do not match');
      return;
    }
    setPwBusy(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      sessionStorage.setItem('storyforge.pwchanged', '1');
      setAuthToken(null);
      window.location.hash = '#/login';
    } catch (err) {
      setPwError((err as Error).message);
      setPwBusy(false);
    }
  };

  const inputs = () => (
    <>
      <div className="field">
        <label>Display name</label>
        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </div>
      <div className="field">
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
    </>
  );

  return (
    <div className="page">
      <div className="page-head">
        <h1>Profile</h1>
        <span className="muted small">
          {me?.user.systemRole.toLowerCase()} account
          {me?.user.systemRole === 'ADMIN' && <span className="tag">admin</span>}
        </span>
      </div>

      {error && <div className="banner error">{error}</div>}
      {saved && <div className="banner ok">Profile updated</div>}

      <form className="card settings-card" onSubmit={submitProfile}>
        <h3>Your information</h3>
        {inputs()}
        <button className="primary" type="submit" disabled={busy || !displayName.trim() || !email.trim()}>
          Save changes
        </button>
      </form>

      <form className="card settings-card" onSubmit={submitPassword}>
        <h3>Change password</h3>
        <p className="muted small">You will be signed out after changing your password.</p>
        {pwError && <div className="banner error">{pwError}</div>}
        <div className="field">
          <label>Current password</label>
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </div>
        <div className="field">
          <label>New password</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
        </div>
        <div className="field">
          <label>Confirm new password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
        </div>
        <button className="primary" type="submit" disabled={pwBusy || !currentPassword || !newPassword || !confirm}>
          Update password
        </button>
      </form>
    </div>
  );
}